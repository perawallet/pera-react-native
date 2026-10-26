/*
 Copyright 2022-2026 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Decimal } from 'decimal.js'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import {
    CHAIN_CAPABILITIES,
    transactionReviewers,
    type ChainCapabilities,
    type ChainScope,
    type DecodedTransactions,
    type ReviewedTransaction,
    type ReviewWarning,
    type TransactionReviewer,
    type UnsignedTransaction,
    i18nKey,
} from '@perawallet/wallet-core-chain-contract'
import { getProvider } from '@perawallet/wallet-extension-provider'
import { fakeReviewerAdapter } from '../../__tests__/fakeReviewerAdapter'
import { reviewerChainAdapters } from '../../chain-adapter'
import { AnalysisError, InvalidSignableDataError } from '../errors'
import {
    bridgeTransactionReviewer,
    reviewerFor,
} from '../transactionReviewerBridge'
import type {
    AnalysisContext,
    SignableAnalysis,
    SignableData,
    SignableGroup,
    SourceType,
} from '../types'

const SCOPE: ChainScope = { chainId: 'ethereum', networkId: 'mainnet' }
const SENDER = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'

const CAPABILITIES = Object.fromEntries(
    CHAIN_CAPABILITIES.map(capability => [
        capability,
        capability === 'contractDecoding',
    ]),
) as ChainCapabilities

const TRANSACTION: UnsignedTransaction = {
    scope: SCOPE,
    payload: { opaque: true },
    summary: {
        kind: 'transfer',
        title: { key: i18nKey('test') },
        direction: 'out',
        icon: 'send',
    },
    chainData: { family: 'evm' },
}

const REVIEWED: ReviewedTransaction = {
    summary: {
        kind: 'contract-call',
        title: { key: i18nKey('transactions.list_item.contract_call') },
        direction: 'none',
        icon: 'contract-call',
    },
    native: { family: 'evm', transaction: { kind: 'contract-call' } },
}

const WARNING: ReviewWarning = {
    type: 'unknown-contract',
    severity: 'warning',
    message: 'unknown',
}

const DECODED: DecodedTransactions = {
    totalFees: new Decimal('420000000000000'),
    signableAddresses: [SENDER],
    transactions: [REVIEWED],
}

const CONTEXT: AnalysisContext = {
    scope: SCOPE,
    accounts: [
        {
            address: 'ALGORAND_ADDRESS',
            chains: { ethereum: { address: SENDER } },
        },
        { address: 'ALGORAND_ONLY', chains: { algorand: { address: 'A' } } },
    ] as unknown as WalletAccount[],
}

const fakeTransactionReviewer = (): TransactionReviewer => ({
    chainId: 'ethereum',
    decoder: { decode: vi.fn(async () => DECODED) },
    warnings: { detect: vi.fn(() => [WARNING]) },
    policy: { autoApproveLocal: vi.fn(() => false) },
})

const groupOf = (
    data: SignableData,
    sourceType: SourceType = 'walletconnect',
): SignableGroup => ({
    data,
    source: { type: sourceType },
    signerAddress: SENDER,
})

const transactionsGroup = (sourceType?: SourceType) =>
    groupOf(
        { type: 'transactions', transactions: [TRANSACTION], chainData: {} },
        sourceType,
    )

const MESSAGE_GROUP = groupOf({ type: 'arbitrary-data', data: [] })

beforeEach(() => {
    vi.spyOn(getProvider().chains, 'capabilities').mockReturnValue(CAPABILITIES)
})

afterEach(() => {
    vi.restoreAllMocks()
})

describe('reviewerFor', () => {
    beforeEach(() => {
        reviewerChainAdapters.reset()
        transactionReviewers.reset()
    })

    it("prefers the signing package's reviewer when the chain registers one", () => {
        const signingReviewer = fakeReviewerAdapter({ chainId: 'ethereum' })
        reviewerChainAdapters.register(signingReviewer)
        transactionReviewers.register(fakeTransactionReviewer())

        expect(reviewerFor('ethereum')).toBe(signingReviewer)
    })

    it("bridges the chain's transaction reviewer otherwise", async () => {
        const reviewer = fakeTransactionReviewer()
        transactionReviewers.register(reviewer)

        await reviewerFor('ethereum').decoder.decode(
            transactionsGroup(),
            CONTEXT,
        )

        expect(reviewer.decoder.decode).toHaveBeenCalledOnce()
    })

    it('refuses a chain with no reviewer of either kind', () => {
        expect(() => reviewerFor('ethereum')).toThrow(
            expect.objectContaining({ name: 'ChainAdapterNotRegisteredError' }),
        )
    })
})

describe('bridgeTransactionReviewer', () => {
    describe('decode', () => {
        it.each([
            ['local', true],
            ['walletconnect', false],
            ['injected', false],
        ] as const)(
            "hands a %s request's reviewer the held addresses, whether the app built it, and the chain's capabilities",
            async (sourceType, isWalletBuilt) => {
                const reviewer = fakeTransactionReviewer()

                await bridgeTransactionReviewer(reviewer).decoder.decode(
                    transactionsGroup(sourceType),
                    CONTEXT,
                )

                expect(reviewer.decoder.decode).toHaveBeenCalledWith(
                    [TRANSACTION],
                    {
                        scope: SCOPE,
                        heldAddresses: [SENDER],
                        isWalletBuilt,
                        capabilities: CAPABILITIES,
                    },
                )
                expect(getProvider().chains.capabilities).toHaveBeenCalledWith(
                    'ethereum',
                )
            },
        )

        it('converts the fee to bigint and carries the transactions', async () => {
            const decoded = await bridgeTransactionReviewer(
                fakeTransactionReviewer(),
            ).decoder.decode(transactionsGroup(), CONTEXT)

            expect(decoded).toEqual({
                totalFees: 420_000_000_000_000n,
                signableAddresses: [SENDER],
                transactions: [REVIEWED],
            })
        })

        it('gives message data no fee and every held address', async () => {
            const reviewer = fakeTransactionReviewer()

            const decoded = await bridgeTransactionReviewer(
                reviewer,
            ).decoder.decode(MESSAGE_GROUP, CONTEXT)

            expect(decoded).toEqual({
                totalFees: 0n,
                signableAddresses: [SENDER],
                transactions: [],
            })
            expect(reviewer.decoder.decode).not.toHaveBeenCalled()
        })

        it("turns the chain's refusal into a non-retryable invalid-data error", async () => {
            const reviewer = fakeTransactionReviewer()
            vi.mocked(reviewer.decoder.decode).mockRejectedValue(
                new Error('The Ethereum transaction payload is malformed'),
            )

            const error = await bridgeTransactionReviewer(reviewer)
                .decoder.decode(transactionsGroup(), CONTEXT)
                .catch((caught: unknown) => caught)

            expect(error).toBeInstanceOf(InvalidSignableDataError)
            expect((error as InvalidSignableDataError).message).toContain(
                'The Ethereum transaction payload is malformed',
            )
            expect((error as InvalidSignableDataError).metadata.retryable).toBe(
                false,
            )
        })

        it('passes a pipeline error through as it is', async () => {
            const reviewer = fakeTransactionReviewer()
            const failure = new AnalysisError('node unreachable')
            vi.mocked(reviewer.decoder.decode).mockRejectedValue(failure)

            await expect(
                bridgeTransactionReviewer(reviewer).decoder.decode(
                    transactionsGroup(),
                    CONTEXT,
                ),
            ).rejects.toBe(failure)
        })
    })

    describe('detect', () => {
        it('hands the reviewer what was decoded, with the fee back in base units', () => {
            const reviewer = fakeTransactionReviewer()

            const warnings = bridgeTransactionReviewer(
                reviewer,
            ).warnings.detect(
                transactionsGroup('local'),
                {
                    totalFees: 420_000_000_000_000n,
                    signableAddresses: [SENDER],
                    transactions: [REVIEWED],
                },
                CONTEXT,
            )

            expect(warnings).toEqual([WARNING])
            expect(reviewer.warnings.detect).toHaveBeenCalledWith(
                [TRANSACTION],
                DECODED,
                expect.objectContaining({ isWalletBuilt: true }),
            )
        })

        it('finds nothing to warn about in message data', () => {
            const reviewer = fakeTransactionReviewer()

            expect(
                bridgeTransactionReviewer(reviewer).warnings.detect(
                    MESSAGE_GROUP,
                    {
                        totalFees: 0n,
                        signableAddresses: [SENDER],
                        transactions: [],
                    },
                    CONTEXT,
                ),
            ).toEqual([])
            expect(reviewer.warnings.detect).not.toHaveBeenCalled()
        })
    })

    describe('policy', () => {
        it("decides on the analysis's transactions and warnings", () => {
            const reviewer = fakeTransactionReviewer()
            const analysis: SignableAnalysis = {
                totalFees: 420_000_000_000_000n,
                transactions: [REVIEWED],
                warnings: [WARNING],
                signableAddresses: [SENDER],
                riskLevel: 'medium',
            }

            const isApproved =
                bridgeTransactionReviewer(reviewer).policy.autoApproveLocal(
                    analysis,
                )

            expect(isApproved).toBe(false)
            expect(reviewer.policy.autoApproveLocal).toHaveBeenCalledWith({
                ...DECODED,
                warnings: [WARNING],
            })
        })

        it('asks the chain whether a transaction matches the preview it was approved as', () => {
            const matchesApprovedPreview = vi.fn(() => true)
            const reviewer: TransactionReviewer = {
                ...fakeTransactionReviewer(),
                policy: {
                    autoApproveLocal: vi.fn(() => false),
                    matchesApprovedPreview,
                },
            }
            const [transaction, preview] = [
                { id: 'built' },
                { id: 'preview' },
            ] as unknown as UnsignedTransaction[]

            const policy = bridgeTransactionReviewer(reviewer).policy

            expect(policy.matchesApprovedPreview?.(transaction, preview)).toBe(
                true,
            )
            expect(matchesApprovedPreview).toHaveBeenCalledWith(
                transaction,
                preview,
            )
        })

        it('matches no preview for a chain that shows none', () => {
            expect(
                bridgeTransactionReviewer(fakeTransactionReviewer()).policy
                    .matchesApprovedPreview,
            ).toBeUndefined()
        })
    })
})

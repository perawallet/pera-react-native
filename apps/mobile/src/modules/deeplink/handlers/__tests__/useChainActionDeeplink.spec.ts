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
import { act, renderHook } from '@testing-library/react'

import { Decimal } from 'decimal.js'
import {
    addressCodecs,
    type ChainActionData,
    type ChainId,
} from '@perawallet/wallet-core-chain-contract'
import {
    ChainActionBuildError,
    deeplinkAdapters,
    DeeplinkType,
    type ChainActionDeeplink,
    type ChainLinkTarget,
    type DeeplinkChainAdapter,
} from '@perawallet/wallet-core-deeplinks'
import { registerLegacyAddressCodec } from '@test-utils/chain-fixtures'
import { DeeplinkTimeoutError } from '../timeout'

const {
    mockAddSignRequest,
    mockShowError,
    mockBuildChainAction,
    mockLogError,
    mockAllAccounts,
    mockResolveSignerForAccount,
    mockNetwork,
    mockAssignFeeToGroup,
} = vi.hoisted(() => ({
    mockAddSignRequest: vi.fn(),
    mockShowError: vi.fn(),
    mockBuildChainAction: vi.fn(),
    mockLogError: vi.fn(),
    mockAllAccounts: {
        current: [] as {
            id: string
            chains: { algorand: { address: string } }
        }[],
    },
    mockResolveSignerForAccount: vi.fn(
        (_account?: unknown, _accounts?: unknown) =>
            ({ kind: 'ok' }) as { kind: string; authorityAddress?: string },
    ),
    mockNetwork: { current: 'mainnet' },
    mockAssignFeeToGroup: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-chain-shared', () => ({
    getSelectedScope: (chainId: string) => ({
        chainId,
        networkId: mockNetwork.current,
    }),
    getChainDescriptor: (chainId: string) => ({
        displayName: chainId === 'algorand' ? 'Algorand' : 'Ethereum',
        networks: [{ id: 'testnet', displayName: 'TestNet' }],
    }),
}))

vi.mock('@perawallet/wallet-core-signing', () => ({
    // The chain's planner keeps the facts its own way; this one keeps them as given.
    plannerChainAdapters: {
        get: () => ({ signRequestChainData: (facts: unknown) => facts }),
    },
    useSigningRequest: () => ({ addSignRequest: mockAddSignRequest }),
    useMinimumFeeCalculatorFor: () => () => mockAssignFeeToGroup,
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useAllAccounts: () => mockAllAccounts.current,
    findAccountByAddressOn: (
        accounts: typeof mockAllAccounts.current,
        chainId: 'algorand',
        address: string,
    ) => accounts.find(a => a.chains[chainId]?.address === address),
    resolveSignerForAccount: (account: unknown, accounts: unknown) =>
        mockResolveSignerForAccount(account, accounts),
}))

vi.mock('@perawallet/wallet-core-shared', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-shared')
    >()),
    logger: { debug: vi.fn(), warn: vi.fn(), error: mockLogError },
    generateOrderedUniqueId: () => 'test-sign-request-id',
}))

vi.mock('../useDeeplinkErrorHandler', () => ({
    useDeeplinkErrorHandler: () => mockShowError,
}))

import { useChainActionDeeplink } from '../useChainActionDeeplink'

const VALID_ADDRESS =
    '5CYNWZY5JO7RWAPEQLWOTDULMDSSKJ55PHXNRTGZXUR62B7PR7JIDJGHEA'
const BUILT_TX = { kind: 'built-tx' }

const fakeAdapter = (
    chainId: ChainId,
    buildChainAction?: DeeplinkChainAdapter['buildChainAction'],
): DeeplinkChainAdapter => ({
    chainId,
    schemes: [chainId],
    canParse: () => false,
    parse: () => ({ kind: 'malformed' }) as never,
    toAssetRef: () => undefined,
    buildChainAction,
})

const chainActionLink = (
    chainData: Partial<ChainActionData> = {},
    target: ChainLinkTarget = { chainId: 'algorand' },
): ChainActionDeeplink => ({
    type: DeeplinkType.CHAIN_ACTION,
    sourceUrl: 'perawallet://app/keyreg/?senderAddress=...',
    target,
    chainData: {
        family: 'algorand',
        action: 'keyreg',
        sender: VALID_ADDRESS,
        keyregType: 'offline',
        ...chainData,
    },
})

const seedSenderInWallet = () => {
    mockAllAccounts.current = [
        {
            id: 'wallet-account-1',
            chains: { algorand: { address: VALID_ADDRESS } },
        },
    ]
}

const submit = async (link: ChainActionDeeplink) => {
    const { result } = renderHook(() => useChainActionDeeplink())
    await act(async () => {
        await result.current(link)
    })
}

describe('useChainActionDeeplink', () => {
    beforeEach(() => {
        // Base32 shape only, enough to tell a valid sender from an invalid one.
        registerLegacyAddressCodec(address => /^[A-Z2-7]{58}$/.test(address))
        deeplinkAdapters.register(fakeAdapter('algorand', mockBuildChainAction))
        deeplinkAdapters.register(fakeAdapter('ethereum'))
        vi.clearAllMocks()
        mockResolveSignerForAccount.mockReturnValue({ kind: 'ok' })
        mockNetwork.current = 'mainnet'
        mockAllAccounts.current = []
        mockBuildChainAction.mockResolvedValue(BUILT_TX)
        // Non-quantum default: the calculator's real fast path is a
        // passthrough with no adjustments.
        mockAssignFeeToGroup.mockImplementation(
            async ({ transactions }: { transactions: unknown[] }) => ({
                transactions,
                adjustments: [],
            }),
        )
    })

    afterEach(() => {
        vi.useRealTimers()
        addressCodecs.reset()
        deeplinkAdapters.reset()
    })

    describe('preflight gating', () => {
        it("refuses a chain whose deeplink adapter builds no chain action, with the chain's name", async () => {
            seedSenderInWallet()

            await submit(chainActionLink({}, { chainId: 'ethereum' }))

            expect(mockShowError).toHaveBeenCalledExactlyOnceWith(
                expect.objectContaining({
                    variant: 'unsupported-on-chain',
                    values: { chain: 'Ethereum' },
                }),
            )
            expect(mockAddSignRequest).not.toHaveBeenCalled()
        })

        it('rejects an invalid sender address without building', async () => {
            await submit(chainActionLink({ sender: 'NOT-AN-ADDRESS' }))

            expect(mockShowError).toHaveBeenCalledExactlyOnceWith(
                expect.objectContaining({
                    variant: 'chain-action',
                    action: 'keyreg',
                    error: 'Invalid sender address',
                }),
            )
            expect(mockBuildChainAction).not.toHaveBeenCalled()
            expect(mockAddSignRequest).not.toHaveBeenCalled()
        })

        it("rejects a sender the wallet doesn't hold as an unknown account", async () => {
            await submit(chainActionLink())

            expect(mockShowError).toHaveBeenCalledExactlyOnceWith(
                expect.objectContaining({
                    variant: 'chain-action-unknown-account',
                    action: 'keyreg',
                    error: expect.stringContaining('is not in this wallet'),
                }),
            )
            expect(mockBuildChainAction).not.toHaveBeenCalled()
        })

        // ARC-90 `net:`/`gh:` names the network. The txn is built on the
        // ACTIVE network and carries its genesis hash, so no later check can
        // tell a wrong-network action apart. Fail closed instead.
        it('rejects a link whose target network is not the active one', async () => {
            seedSenderInWallet()

            await submit(
                chainActionLink(
                    {},
                    { chainId: 'algorand', networkId: 'testnet' },
                ),
            )

            expect(mockShowError).toHaveBeenCalledExactlyOnceWith(
                expect.objectContaining({
                    variant: 'network-mismatch',
                    values: { network: 'TestNet' },
                }),
            )
            expect(mockBuildChainAction).not.toHaveBeenCalled()
        })

        it('accepts a target naming the active network', async () => {
            seedSenderInWallet()

            await submit(
                chainActionLink(
                    {},
                    { chainId: 'algorand', networkId: 'mainnet' },
                ),
            )

            expect(mockShowError).not.toHaveBeenCalled()
            expect(mockAddSignRequest).toHaveBeenCalledTimes(1)
        })

        // A watch-only sender is in the wallet with an intact rekey chain; only
        // the pipeline's machine init would notice it can't sign, after the
        // review sheet already opened.
        it.each(['watch', 'authIsWatch'])(
            'rejects a sender whose resolved signer is %s before opening the review sheet',
            async kind => {
                seedSenderInWallet()
                mockResolveSignerForAccount.mockReturnValue({ kind })

                await submit(chainActionLink())

                expect(mockShowError).toHaveBeenCalledExactlyOnceWith(
                    expect.objectContaining({
                        variant: 'chain-action-cannot-sign',
                        action: 'keyreg',
                    }),
                )
                expect(mockBuildChainAction).not.toHaveBeenCalled()
            },
        )

        // Unlike an unsignable signer, a missing rekey target is fixable by
        // adding it, so it gets the unknown-account copy.
        it('rejects a missing rekey target as an unknown account', async () => {
            seedSenderInWallet()
            mockResolveSignerForAccount.mockReturnValue({
                kind: 'authMissing',
                authorityAddress: 'AUTH',
            })

            await submit(chainActionLink())

            expect(mockShowError).toHaveBeenCalledExactlyOnceWith(
                expect.objectContaining({
                    variant: 'chain-action-unknown-account',
                    error: expect.stringContaining('AUTH'),
                }),
            )
            expect(mockAddSignRequest).not.toHaveBeenCalled()
        })
    })

    describe('building and enqueueing', () => {
        it("hands the link's chain data and the active scope to the chain's builder, then queues a deeplink-source sign request", async () => {
            seedSenderInWallet()
            const link = chainActionLink({ note: 'going offline' })

            await submit(link)

            expect(mockBuildChainAction).toHaveBeenCalledExactlyOnceWith(
                link.chainData,
                { scope: { chainId: 'algorand', networkId: 'mainnet' } },
            )
            expect(mockAddSignRequest).toHaveBeenCalledExactlyOnceWith(
                expect.objectContaining({
                    type: 'transactions',
                    transport: 'algod',
                    // 'local' is headless and would silently auto-sign; only
                    // 'deeplink' gets the review sheet.
                    sourceType: 'deeplink',
                    txs: [BUILT_TX],
                }),
            )
            expect(mockShowError).not.toHaveBeenCalled()
        })
    })

    describe('PQ fee floor', () => {
        // The calculator is mocked at the signing boundary; its quantum logic
        // is covered in chain-algorand's useAssignFeeToGroup.spec.ts. These
        // only check the built txn goes through it and the delta shows for an
        // explicit link fee alone.
        const raisedTx = { kind: 'built-tx', fee: 3000n }
        const adjustments = [
            {
                index: 0,
                originalFee: 1000n,
                adjustedFee: 3000n,
                reason: 'quantum-minimum',
            },
        ]

        beforeEach(() => {
            mockAssignFeeToGroup.mockImplementation(async () => ({
                transactions: [raisedTx],
                adjustments,
            }))
        })

        it("enqueues the calculator's raised txn with the adjustment surfaced for an explicit link fee", async () => {
            seedSenderInWallet()

            await submit(chainActionLink({ fee: new Decimal(1000) }))

            expect(mockAssignFeeToGroup).toHaveBeenCalledExactlyOnceWith({
                transactions: [BUILT_TX],
            })
            expect(mockAddSignRequest).toHaveBeenCalledExactlyOnceWith(
                expect.objectContaining({
                    txs: [raisedTx],
                    chainData: { feeAdjustments: adjustments },
                }),
            )
        })

        it('omits the delta when the link set no fee (Pera-set, not an override)', async () => {
            seedSenderInWallet()

            await submit(chainActionLink())

            expect(mockAddSignRequest).toHaveBeenCalledExactlyOnceWith(
                expect.objectContaining({
                    txs: [raisedTx],
                    chainData: { feeAdjustments: undefined },
                }),
            )
        })
    })

    describe('build failures', () => {
        it("shows a ChainActionBuildError's reason without logging it, since the link is at fault", async () => {
            seedSenderInWallet()
            mockBuildChainAction.mockRejectedValueOnce(
                new ChainActionBuildError(
                    'missing-fields',
                    'Missing required participation key fields',
                ),
            )

            await submit(chainActionLink())

            expect(mockShowError).toHaveBeenCalledExactlyOnceWith(
                expect.objectContaining({
                    variant: 'chain-action',
                    action: 'keyreg',
                    error: 'Missing required participation key fields',
                }),
            )
            expect(mockLogError).not.toHaveBeenCalled()
            expect(mockAddSignRequest).not.toHaveBeenCalled()
        })

        it('logs any other build failure and routes it to the error toast instead of throwing', async () => {
            seedSenderInWallet()
            const buildErr = new Error('algod refused to compute params')
            mockBuildChainAction.mockRejectedValueOnce(buildErr)

            await submit(chainActionLink())

            expect(mockLogError).toHaveBeenCalledTimes(1)
            expect(mockShowError).toHaveBeenCalledExactlyOnceWith(
                expect.objectContaining({
                    variant: 'chain-action',
                    action: 'keyreg',
                    error: buildErr,
                }),
            )
            expect(mockAddSignRequest).not.toHaveBeenCalled()
        })

        // An unreachable node never answers the fee-params fetch; without the
        // timeout the dispatcher's await, and the QR scanner, hang forever.
        it('gives up on a build that never settles and reports a timeout', async () => {
            vi.useFakeTimers()
            seedSenderInWallet()
            mockBuildChainAction.mockReturnValueOnce(new Promise(() => {}))
            const { result } = renderHook(() => useChainActionDeeplink())

            let pending!: Promise<void>
            act(() => {
                pending = result.current(chainActionLink())
            })
            await act(async () => {
                await vi.advanceTimersByTimeAsync(12_000)
                await pending
            })

            expect(mockShowError).toHaveBeenCalledExactlyOnceWith(
                expect.objectContaining({
                    error: expect.any(DeeplinkTimeoutError),
                }),
            )
            expect(mockAddSignRequest).not.toHaveBeenCalled()
        })
    })
})

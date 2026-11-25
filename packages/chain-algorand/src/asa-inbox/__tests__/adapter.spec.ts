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

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ZodError } from 'zod'
import { algorandAssetInbox } from '../adapter'
import { payloadTransactionOf } from '../../signing/__tests__/transactions'
import { toAssetInboxQuote } from '@perawallet/wallet-core-transactions'
import { ALGORAND_CHAIN_ID } from '../../chain-id'

const mocks = vi.hoisted(() => ({
    createWalletAlgorandClient: vi.fn(),
    getSuggestedParams: vi.fn(),
    buildArc59SendViaInboxTxs: vi.fn(),
    buildArc59ClaimTxs: vi.fn(),
    buildArc59RejectTxs: vi.fn(),
    fetchArc59AssetRequests: vi.fn(),
    fetchArc59SendSummary: vi.fn(),
    resolveAlgorandSenderFee: vi.fn(),
}))

vi.mock('../../blockchain', () => ({
    createWalletAlgorandClient: mocks.createWalletAlgorandClient,
}))
vi.mock('../api', async importOriginal => ({
    ...(await importOriginal<typeof import('../api')>()),
    fetchArc59AssetRequests: mocks.fetchArc59AssetRequests,
    fetchArc59SendSummary: mocks.fetchArc59SendSummary,
}))
vi.mock('../../transactions/transfer-fees', () => ({
    resolveAlgorandSenderFee: mocks.resolveAlgorandSenderFee,
}))
vi.mock('../builders', () => ({
    buildArc59SendViaInboxTxs: mocks.buildArc59SendViaInboxTxs,
    buildArc59ClaimTxs: mocks.buildArc59ClaimTxs,
    buildArc59RejectTxs: mocks.buildArc59RejectTxs,
}))

const CLIENT = {
    name: 'wallet-client',
    getSuggestedParams: mocks.getSuggestedParams,
}
const TXNS = [{ txn: 'stub', sender: 'SENDER' }]

const summary = {
    is_arc59_opted_in: true,
    minimum_balance_requirement: 100000,
    inner_tx_count: 2,
    total_protocol_and_mbr_fee: 4000,
    inbox_address: null,
    algo_fund_amount: 0,
    warning_message: null,
}

const inbox = algorandAssetInbox

describe('algorandAssetInbox', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.createWalletAlgorandClient.mockReturnValue(CLIENT)
        mocks.getSuggestedParams.mockResolvedValue({ minFee: 1000n })
        mocks.resolveAlgorandSenderFee.mockImplementation(
            (_sender: string, minFee: bigint) => minFee,
        )
        mocks.buildArc59SendViaInboxTxs.mockResolvedValue({
            transactions: TXNS,
            networkFee: 5500n,
        })
        mocks.buildArc59ClaimTxs.mockResolvedValue(TXNS)
        mocks.buildArc59RejectTxs.mockResolvedValue(TXNS)
    })

    it("fetches the scope's network requests through the Pera backend reader", async () => {
        const requests = [{ id: '1' }]
        mocks.fetchArc59AssetRequests.mockResolvedValue(requests)

        const result = await inbox.fetchRequests({
            scope: {
                chainId: ALGORAND_CHAIN_ID,
                networkId: 'testnet',
            } as const,
            address: 'RECEIVER',
        })

        expect(result).toBe(requests)
        expect(mocks.fetchArc59AssetRequests).toHaveBeenCalledWith(
            'testnet',
            'RECEIVER',
        )
    })

    it('quotes a send with the signed funding amount as algo_fund_amount plus minimum_balance_requirement', async () => {
        mocks.fetchArc59SendSummary.mockResolvedValue({
            ...summary,
            algo_fund_amount: 200_000,
            minimum_balance_requirement: 100_000,
        })

        const result = await inbox.fetchSendSummary({
            scope: {
                chainId: ALGORAND_CHAIN_ID,
                networkId: 'mainnet',
            } as const,
            sender: 'SENDER',
            receiver: 'RECEIVER',
            assetId: '7',
            amount: 10n,
        })

        expect(mocks.fetchArc59SendSummary).toHaveBeenCalledWith(
            'mainnet',
            'RECEIVER',
            '7',
        )
        expect(result.fundingAmount).toBe(300_000n)
        expect(result.quote).toMatchObject({
            summary: { algo_fund_amount: 200_000 },
            networkFee: result.networkFee,
        })
    })

    it('quotes the assembled fee at the sender’s PQ-aware rate', async () => {
        const funded = { ...summary, algo_fund_amount: 200_000 }
        mocks.resolveAlgorandSenderFee.mockReturnValue(3000n)
        mocks.fetchArc59SendSummary.mockResolvedValue(funded)
        mocks.buildArc59SendViaInboxTxs.mockResolvedValueOnce({
            transactions: TXNS,
            networkFee: 12_500n,
        })

        const result = await inbox.fetchSendSummary({
            scope: { chainId: ALGORAND_CHAIN_ID, networkId: 'mainnet' },
            sender: 'SENDER',
            receiver: 'RECEIVER',
            assetId: '7',
            amount: 10n,
        })

        expect(mocks.resolveAlgorandSenderFee).toHaveBeenCalledWith(
            'SENDER',
            1000n,
        )
        expect(mocks.buildArc59SendViaInboxTxs).toHaveBeenCalledWith(
            { algokit: CLIENT, network: 'mainnet' },
            {
                sender: 'SENDER',
                receiver: 'RECEIVER',
                assetId: 7n,
                amount: 10n,
                summary: funded,
                senderMinFee: 3000n,
            },
        )
        expect(result.networkFee).toBe(12_500n)
    })

    it("builds with the approved quote's fee after the sender minimum changes", async () => {
        const scope = {
            chainId: ALGORAND_CHAIN_ID,
            networkId: 'testnet',
        } as const
        const recipient = { sender: 'SENDER', receiver: 'RECEIVER' }
        mocks.fetchArc59SendSummary.mockResolvedValue(summary)
        const { quote } = await inbox.fetchSendSummary({
            scope,
            ...recipient,
            assetId: '7',
            amount: 10n,
        })
        const result = await inbox.buildSendTxs({
            scope,
            ...recipient,
            assetId: 7n,
            amount: 10n,
            quote,
            senderMinFee: 2000n,
        })

        expect(result.map(payloadTransactionOf)).toEqual(TXNS)
        expect(result[0].scope).toEqual({
            chainId: ALGORAND_CHAIN_ID,
            networkId: 'testnet',
        } as const)
        expect(mocks.createWalletAlgorandClient).toHaveBeenCalledWith('testnet')
        expect(mocks.buildArc59SendViaInboxTxs).toHaveBeenCalledWith(
            { algokit: CLIENT, network: 'testnet' },
            {
                sender: 'SENDER',
                receiver: 'RECEIVER',
                assetId: 7n,
                amount: 10n,
                summary,
                senderMinFee: 2000n,
                maxFee: 5500n,
            },
        )
    })

    it('refuses to build from a quote that fails the ARC-59 schema', async () => {
        await expect(
            inbox.buildSendTxs({
                scope: {
                    chainId: ALGORAND_CHAIN_ID,
                    networkId: 'mainnet',
                } as const,
                sender: 'SENDER',
                receiver: 'RECEIVER',
                assetId: 7n,
                amount: 10n,
                quote: toAssetInboxQuote({
                    summary: { ...summary, algo_fund_amount: 50_000_000 },
                    network: 'mainnet',
                    sender: 'SENDER',
                    receiver: 'RECEIVER',
                    assetId: '7',
                    amount: 10n,
                    networkFee: 5000n,
                }),
                senderMinFee: 1000n,
            }),
        ).rejects.toBeInstanceOf(ZodError)
        expect(mocks.buildArc59SendViaInboxTxs).not.toHaveBeenCalled()
    })

    it.each([
        { receiver: 'OTHER_RECIPIENT', amount: 10n },
        { receiver: 'RECEIVER', amount: 11n },
    ])(
        'refuses an approved quote for another recipient or amount: %o',
        async request => {
            const scope = {
                chainId: ALGORAND_CHAIN_ID,
                networkId: 'testnet',
            } as const
            mocks.fetchArc59SendSummary.mockResolvedValue(summary)
            const { quote } = await inbox.fetchSendSummary({
                scope,
                sender: 'SENDER',
                receiver: 'RECEIVER',
                assetId: '7',
                amount: 10n,
            })
            await expect(
                inbox.buildSendTxs({
                    scope,
                    sender: 'SENDER',
                    ...request,
                    assetId: 7n,
                    quote,
                    senderMinFee: 1000n,
                }),
            ).rejects.toThrow()
            expect(mocks.buildArc59SendViaInboxTxs).toHaveBeenCalledTimes(1)
        },
    )

    it('builds claims and rejects on the requested scope', async () => {
        const claim = {
            sender: 'SENDER',
            assetId: 7n,
            shouldClaimAlgo: true,
            inboxAddress: 'INBOX',
            senderMinFee: 1000n,
        }
        const scope = {
            chainId: ALGORAND_CHAIN_ID,
            networkId: 'mainnet',
        } as const

        await inbox.buildClaimTxs({ scope, ...claim })
        await inbox.buildRejectTxs({
            scope,
            ...claim,
            assetCreator: 'CREATOR',
        })

        expect(mocks.buildArc59ClaimTxs).toHaveBeenCalledWith(
            { algokit: CLIENT, network: 'mainnet' },
            claim,
        )
        expect(mocks.buildArc59RejectTxs).toHaveBeenCalledWith(
            { algokit: CLIENT, network: 'mainnet' },
            { ...claim, assetCreator: 'CREATOR' },
        )
    })
})

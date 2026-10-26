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
import { Decimal } from 'decimal.js'
import type { TransactionHistoryItem } from '@perawallet/wallet-core-transactions'
import { ALGORAND_CHAIN_ID } from '../../chain-id'

const mocks = vi.hoisted(() => ({
    fetchTransactionHistory: vi.fn(),
    fetchMoreTransactions: vi.fn(),
}))

vi.mock('../history', () => ({
    fetchTransactionHistory: mocks.fetchTransactionHistory,
    fetchMoreTransactions: mocks.fetchMoreTransactions,
}))
vi.mock('../history/indexer/endpoints', () => ({
    fetchIndexerCloseAmount: vi.fn(),
}))

import { algorandAssetInbox } from '../../asa-inbox/adapter'
import {
    algorandHistoryAdapter,
    algorandSendFlowAdapter,
    algorandTransferAdapter,
} from '../adapter'
import { getAlgorandAddressPoisoningRules } from '../address-poisoning'
import {
    EMPTY_ALGORAND_HISTORY_DATA,
    type AlgorandHistoryData,
} from '../history-data'
import { LEGACY_CHAIN_ID } from '@perawallet/wallet-core-chain-contract'

const testnet = { chainId: LEGACY_CHAIN_ID, networkId: 'testnet' } as const

describe('algorandSendFlowAdapter', () => {
    it('serves the Algorand chain with every optional feature', () => {
        expect(algorandSendFlowAdapter.chainId).toBe(ALGORAND_CHAIN_ID)
        expect(algorandSendFlowAdapter.assetInbox).toBe(algorandAssetInbox)
        expect(algorandSendFlowAdapter.express).toBeDefined()
        expect(algorandSendFlowAdapter.assetHolding).toBeDefined()
        expect(algorandSendFlowAdapter.rekey).toBeDefined()
    })
})

describe('algorandHistoryAdapter', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('fetches the first page with the scope mapped back to its network', async () => {
        const page = { transactions: [] }
        mocks.fetchTransactionHistory.mockResolvedValueOnce(page)

        const result = await algorandHistoryAdapter.fetchHistory({
            scope: testnet,
            accountAddress: 'ADDR',
            limit: 10,
        })

        expect(result).toBe(page)
        expect(mocks.fetchTransactionHistory).toHaveBeenCalledWith({
            accountAddress: 'ADDR',
            limit: 10,
            network: 'testnet',
        })
    })

    it('fetches a later page with the scope mapped back to its network', async () => {
        await algorandHistoryAdapter.fetchMoreHistory({
            scope: testnet,
            url: 'NEXT',
        })

        expect(mocks.fetchMoreTransactions).toHaveBeenCalledWith({
            url: 'NEXT',
            network: 'testnet',
        })
    })

    it('rejects a scope that is not Algorand', async () => {
        const foreign = { chainId: 'other', networkId: 'main' }

        await expect(
            algorandHistoryAdapter.fetchHistory({
                scope: foreign as never,
                accountAddress: 'ADDR',
            }),
        ).rejects.toThrow('Not an Algorand scope')
        expect(mocks.fetchTransactionHistory).not.toHaveBeenCalled()
    })

    describe('getTransactionHistory', () => {
        const row = (
            overrides: Partial<TransactionHistoryItem> = {},
            data: Partial<AlgorandHistoryData> = {},
        ) =>
            ({
                id: 'TX',
                txType: 'pay',
                sender: 'ADDR',
                assetSender: null,
                receiver: 'R',
                roundTime: 1_700_000_000,
                interpretedMeaning: null,
                fee: new Decimal(1000),
                amount: new Decimal(5),
                asset: null,
                balanceImpacts: [],
                chainData: { ...EMPTY_ALGORAND_HISTORY_DATA, ...data },
                ...overrides,
            }) as TransactionHistoryItem
        const result = (
            transactions: TransactionHistoryItem[],
            nextUrl: string | null = null,
        ) => ({
            transactions,
            pagination: { hasNextPage: nextUrl !== null, nextUrl },
        })

        it('reads the first page for the address and network', async () => {
            mocks.fetchTransactionHistory.mockResolvedValueOnce(result([row()]))

            await algorandHistoryAdapter.getTransactionHistory('ADDR', testnet)

            expect(mocks.fetchTransactionHistory).toHaveBeenCalledWith({
                accountAddress: 'ADDR',
                network: 'testnet',
            })
        })

        it('reads a later page by its cursor', async () => {
            mocks.fetchMoreTransactions.mockResolvedValueOnce(result([]))

            await algorandHistoryAdapter.getTransactionHistory(
                'ADDR',
                testnet,
                {
                    cursor: 'NEXT',
                    limit: 5,
                },
            )

            expect(mocks.fetchMoreTransactions).toHaveBeenCalledWith({
                url: 'NEXT',
                network: 'testnet',
                accountAddress: 'ADDR',
                limit: 5,
            })
        })

        it('maps an item to a record', async () => {
            mocks.fetchTransactionHistory.mockResolvedValueOnce(
                result([row({}, { groupId: 'GRP', closeTo: 'CLOSE' })]),
            )

            const { items } =
                await algorandHistoryAdapter.getTransactionHistory(
                    'ADDR',
                    testnet,
                )

            expect(items).toEqual([
                {
                    id: 'TX',
                    scope: testnet,
                    status: 'confirmed',
                    timestamp: 1_700_000_000_000,
                    fee: new Decimal(1000),
                    initiator: 'ADDR',
                    summary: expect.objectContaining({ kind: 'transfer' }),
                    chainData: {
                        family: 'algorand',
                        groupId: 'GRP',
                        closeRemainderTo: 'CLOSE',
                    },
                },
            ])
        })

        it('keeps a stored status and leaves the timestamp unset before a round time exists', async () => {
            mocks.fetchTransactionHistory.mockResolvedValueOnce(
                result([row({ status: 'pending', roundTime: 0 })]),
            )

            const { items } =
                await algorandHistoryAdapter.getTransactionHistory(
                    'ADDR',
                    testnet,
                )

            expect(items[0]).toMatchObject({ status: 'pending' })
            expect(items[0].timestamp).toBeUndefined()
        })

        it('offers a next page only while the backend has one', async () => {
            mocks.fetchTransactionHistory.mockResolvedValueOnce(
                result([row()], 'https://next'),
            )
            mocks.fetchTransactionHistory.mockResolvedValueOnce(result([row()]))

            const more = await algorandHistoryAdapter.getTransactionHistory(
                'ADDR',
                testnet,
            )
            const last = await algorandHistoryAdapter.getTransactionHistory(
                'ADDR',
                testnet,
            )

            expect(more.next).toEqual({ cursor: 'https://next' })
            expect(last.next).toBeUndefined()
        })
    })

    it('maps a payment row to its Algorand native form', () => {
        const item = {
            id: 'TX',
            txType: 'pay',
            sender: 'S',
            receiver: 'R',
            confirmedRound: 1,
            roundTime: 2,
            fee: new Decimal(1000),
            amount: new Decimal(5),
            chainData: null,
        } as unknown as TransactionHistoryItem

        expect(algorandHistoryAdapter.toTransactionNative(item)).toMatchObject({
            family: 'algorand',
            transaction: { id: 'TX', paymentTransaction: { receiver: 'R' } },
        })
    })
})

describe('algorandTransferAdapter address poisoning', () => {
    it('screens recipients with the remotely tunable Algorand rules', () => {
        expect(algorandTransferAdapter.addressPoisoning).toBe(
            getAlgorandAddressPoisoningRules,
        )
    })
})

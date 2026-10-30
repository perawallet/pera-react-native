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
import {
    ChainAdapterNotRegisteredError,
    LEGACY_CHAIN_ID,
    type ChainScope,
    type TransactionRecord,
} from '@perawallet/wallet-core-chain-contract'
import {
    assetFactsResolverFor,
    chainDataCodecFor,
    fetchMoreTransactions,
    fetchTransactionDetail,
    fetchTransactionHistory,
    hasCachedHistoryRows,
    healCachedRows,
    historyChainAdapters,
    historyItemGroupToOpen,
    mapHistoryItemToTransactionNative,
    summarizeHistoryItem,
    TransactionHistoryRowsUnsupportedError,
    type HistoryChainAdapter,
} from '../history-adapter'
import { TransactionDetailNotFoundError } from '../errors'
import type { TransactionHistoryItem } from '../models/types'

const RESULT = { transactions: [] }

const makeAdapter = (
    overrides: Partial<HistoryChainAdapter> = {},
): HistoryChainAdapter => ({
    chainId: 'algorand',
    fetchHistory: vi.fn().mockResolvedValue(RESULT),
    fetchMoreHistory: vi.fn().mockResolvedValue(RESULT),
    getTransactionHistory: vi.fn(),
    summarize: vi.fn(),
    toTransactionNative: vi.fn().mockReturnValue(null),
    ...overrides,
})

describe('history adapter wrappers', () => {
    beforeEach(() => {
        historyChainAdapters.reset()
    })

    it("routes the first page to the scope's chain adapter", async () => {
        const adapter = makeAdapter()
        historyChainAdapters.register(adapter)

        const result = await fetchTransactionHistory({
            accountAddress: 'ADDR',
            scope: { chainId: LEGACY_CHAIN_ID, networkId: 'testnet' } as const,
            afterTime: '2026-01-01',
        })

        expect(result).toBe(RESULT)
        expect(adapter.fetchHistory).toHaveBeenCalledWith({
            accountAddress: 'ADDR',
            afterTime: '2026-01-01',
            scope: { chainId: LEGACY_CHAIN_ID, networkId: 'testnet' } as const,
        })
    })

    it("routes a later page to the scope's chain adapter", async () => {
        const adapter = makeAdapter()
        historyChainAdapters.register(adapter)

        await fetchMoreTransactions({
            url: 'NEXT',
            scope: { chainId: LEGACY_CHAIN_ID, networkId: 'mainnet' } as const,
        })

        expect(adapter.fetchMoreHistory).toHaveBeenCalledWith({
            url: 'NEXT',
            scope: { chainId: LEGACY_CHAIN_ID, networkId: 'mainnet' } as const,
        })
    })

    it('delegates the native mapping to the adapter', () => {
        const native = { family: 'algorand', transaction: { id: 'TX' } }
        const adapter = makeAdapter({
            toTransactionNative: vi.fn().mockReturnValue(native),
        })
        historyChainAdapters.register(adapter)
        const item = { id: 'TX' } as TransactionHistoryItem

        expect(mapHistoryItemToTransactionNative(item, 'algorand')).toBe(native)
        expect(adapter.toTransactionNative).toHaveBeenCalledWith(item)
    })

    it("summarises a stored row with the chain adapter, from the address's side", () => {
        const summary = { kind: 'transfer' }
        const adapter = makeAdapter({
            summarize: vi.fn().mockReturnValue(summary),
        })
        historyChainAdapters.register(adapter)
        const item = { id: 'TX' } as TransactionHistoryItem

        expect(summarizeHistoryItem(item, 'ADDR', 'algorand')).toBe(summary)
        expect(adapter.summarize).toHaveBeenCalledWith(item, 'ADDR')
    })

    it("opens the group the chain adapter's groupToOpen names", () => {
        const adapter = makeAdapter({
            groupToOpen: vi.fn().mockReturnValue('GROUP'),
        })
        historyChainAdapters.register(adapter)
        const item = { id: 'TX' } as TransactionHistoryItem

        expect(historyItemGroupToOpen(item, 'algorand')).toBe('GROUP')
        expect(adapter.groupToOpen).toHaveBeenCalledWith(item)
    })

    it('opens no group when the chain adapter declares no groupToOpen', () => {
        historyChainAdapters.register(makeAdapter())

        expect(
            historyItemGroupToOpen(
                { id: 'TX' } as TransactionHistoryItem,
                'algorand',
            ),
        ).toBeNull()
    })

    it("runs the chain's repair for the account", async () => {
        const repair = vi.fn().mockResolvedValue(undefined)
        historyChainAdapters.register(makeAdapter({ healCachedRows: repair }))

        await healCachedRows('ADDR', {
            chainId: LEGACY_CHAIN_ID,
            networkId: 'testnet',
        } as const)

        expect(repair).toHaveBeenCalledWith({
            scope: { chainId: LEGACY_CHAIN_ID, networkId: 'testnet' } as const,
            accountAddress: 'ADDR',
        })
    })

    it('keeps a failed repair from failing the sync', async () => {
        historyChainAdapters.register(
            makeAdapter({
                healCachedRows: vi.fn().mockRejectedValue(new Error('boom')),
            }),
        )

        await expect(
            healCachedRows('ADDR', {
                chainId: LEGACY_CHAIN_ID,
                networkId: 'mainnet',
            } as const),
        ).resolves.toBeUndefined()
    })

    it('repairs nothing on a chain with no repair', async () => {
        historyChainAdapters.register(makeAdapter())

        await expect(
            healCachedRows('ADDR', {
                chainId: LEGACY_CHAIN_ID,
                networkId: 'mainnet',
            } as const),
        ).resolves.toBeUndefined()
    })

    it('names the missing registry when no adapter is registered', async () => {
        await expect(
            fetchTransactionHistory({
                accountAddress: 'A',
                scope: {
                    chainId: LEGACY_CHAIN_ID,
                    networkId: 'mainnet',
                } as const,
            }),
        ).rejects.toBeInstanceOf(ChainAdapterNotRegisteredError)
        expect(() =>
            mapHistoryItemToTransactionNative(
                { id: 'TX' } as TransactionHistoryItem,
                'algorand',
            ),
        ).toThrow('No transaction history adapter is registered')
    })
})

describe('a chain whose history is not cached as rows', () => {
    const scope: ChainScope = { chainId: 'ethereum', networkId: 'mainnet' }

    beforeEach(() => {
        historyChainAdapters.reset()
        historyChainAdapters.register({
            chainId: 'ethereum',
            getTransactionHistory: vi.fn(),
        })
    })

    it('rejects both row fetches with an error naming the chain', async () => {
        await expect(
            fetchTransactionHistory({ accountAddress: 'A', scope }),
        ).rejects.toMatchObject({
            name: 'TransactionHistoryRowsUnsupportedError',
            chainId: 'ethereum',
        })
        await expect(
            fetchMoreTransactions({ url: 'NEXT', scope }),
        ).rejects.toBeInstanceOf(TransactionHistoryRowsUnsupportedError)
    })

    it('reports no cached rows, unlike a row-caching chain or an unregistered one', () => {
        historyChainAdapters.register(makeAdapter())

        expect(hasCachedHistoryRows('ethereum')).toBe(false)
        expect(hasCachedHistoryRows('algorand')).toBe(true)
        expect(hasCachedHistoryRows('solana' as ChainScope['chainId'])).toBe(
            false,
        )
    })

    it('has no codec to store a row with', () => {
        expect(() => chainDataCodecFor('ethereum')).toThrow(
            TransactionHistoryRowsUnsupportedError,
        )
    })

    it('refuses to summarise a stored row', () => {
        expect(() =>
            summarizeHistoryItem(
                { id: 'TX' } as TransactionHistoryItem,
                'A',
                'ethereum',
            ),
        ).toThrow(TransactionHistoryRowsUnsupportedError)
    })

    it('has nothing to display for a stored row', () => {
        expect(
            mapHistoryItemToTransactionNative(
                { id: 'TX' } as TransactionHistoryItem,
                'ethereum',
            ),
        ).toBeNull()
    })
})

describe('fetchTransactionDetail', () => {
    const SCOPE: ChainScope = { chainId: 'ethereum', networkId: 'mainnet' }
    const RECORD = { id: '0xabc', scope: SCOPE } as TransactionRecord

    beforeEach(() => {
        historyChainAdapters.reset()
    })

    it("asks the scope's chain adapter for the record's detail", async () => {
        const native = { family: 'evm', transaction: {} } as const
        const getTransactionDetail = vi.fn().mockResolvedValue(native)
        historyChainAdapters.register(
            makeAdapter({ chainId: 'ethereum', getTransactionDetail }),
        )

        await expect(
            fetchTransactionDetail('0xabc', SCOPE, RECORD),
        ).resolves.toBe(native)
        expect(getTransactionDetail).toHaveBeenCalledWith(
            '0xabc',
            SCOPE,
            RECORD,
        )
    })

    it('rejects when the chain has no way to read one', async () => {
        historyChainAdapters.register(makeAdapter({ chainId: 'ethereum' }))

        await expect(
            fetchTransactionDetail('0xabc', SCOPE, RECORD),
        ).rejects.toBeInstanceOf(TransactionDetailNotFoundError)
    })
})

describe('assetFactsResolverFor', () => {
    const STORED = { unitName: 'asset(0)', decimals: 0 }

    beforeEach(() => {
        historyChainAdapters.reset()
    })

    it("applies the chain adapter's resolver", () => {
        const repaired = { unitName: 'ALGO', decimals: 6 }
        historyChainAdapters.register(
            makeAdapter({ resolveAssetFacts: () => repaired }),
        )

        expect(assetFactsResolverFor('algorand')('0', STORED)).toBe(repaired)
    })

    it('keeps the stored facts when the adapter has no resolver', () => {
        historyChainAdapters.register(makeAdapter())

        expect(assetFactsResolverFor('algorand')('0', STORED)).toBe(STORED)
    })

    it('keeps the stored facts when the chain has no history adapter', () => {
        expect(assetFactsResolverFor('algorand')('0', STORED)).toBe(STORED)
    })
})

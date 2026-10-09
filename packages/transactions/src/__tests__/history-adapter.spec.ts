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
    scopeForLegacyNetwork,
} from '@perawallet/wallet-core-chain-contract'
import {
    assetFactsResolverFor,
    fetchCloseAmount,
    fetchMoreTransactions,
    fetchTransactionHistory,
    historyChainAdapters,
    mapHistoryItemToDisplayableTransaction,
    type HistoryChainAdapter,
} from '../history-adapter'
import type { TransactionHistoryItem } from '../models/types'

const RESULT = { transactions: [] }

const makeAdapter = (
    overrides: Partial<HistoryChainAdapter> = {},
): HistoryChainAdapter => ({
    chainId: 'algorand',
    fetchHistory: vi.fn().mockResolvedValue(RESULT),
    fetchMoreHistory: vi.fn().mockResolvedValue(RESULT),
    toDisplayable: vi.fn().mockReturnValue(null),
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
            scope: scopeForLegacyNetwork('testnet'),
            afterTime: '2026-01-01',
        })

        expect(result).toBe(RESULT)
        expect(adapter.fetchHistory).toHaveBeenCalledWith({
            accountAddress: 'ADDR',
            afterTime: '2026-01-01',
            scope: scopeForLegacyNetwork('testnet'),
        })
    })

    it("routes a later page to the scope's chain adapter", async () => {
        const adapter = makeAdapter()
        historyChainAdapters.register(adapter)

        await fetchMoreTransactions({
            url: 'NEXT',
            scope: scopeForLegacyNetwork('mainnet'),
        })

        expect(adapter.fetchMoreHistory).toHaveBeenCalledWith({
            url: 'NEXT',
            scope: scopeForLegacyNetwork('mainnet'),
        })
    })

    it('delegates the display mapping to the adapter', () => {
        const displayable = { id: 'TX' }
        const adapter = makeAdapter({
            toDisplayable: vi.fn().mockReturnValue(displayable),
        })
        historyChainAdapters.register(adapter)
        const item = { id: 'TX' } as TransactionHistoryItem

        expect(mapHistoryItemToDisplayableTransaction(item, 'algorand')).toBe(
            displayable,
        )
        expect(adapter.toDisplayable).toHaveBeenCalledWith(item)
    })

    it('asks the adapter for a close amount', async () => {
        const lookup = vi.fn().mockResolvedValue('500')
        historyChainAdapters.register(makeAdapter({ fetchCloseAmount: lookup }))

        await expect(
            fetchCloseAmount('TX', scopeForLegacyNetwork('testnet')),
        ).resolves.toBe('500')
        expect(lookup).toHaveBeenCalledWith(
            'TX',
            scopeForLegacyNetwork('testnet'),
        )
    })

    it('reports no close amount when the adapter has no lookup', async () => {
        historyChainAdapters.register(makeAdapter())

        await expect(
            fetchCloseAmount('TX', scopeForLegacyNetwork('mainnet')),
        ).resolves.toBeNull()
    })

    it('names the missing registry when no adapter is registered', async () => {
        await expect(
            fetchTransactionHistory({
                accountAddress: 'A',
                scope: scopeForLegacyNetwork('mainnet'),
            }),
        ).rejects.toBeInstanceOf(ChainAdapterNotRegisteredError)
        expect(() =>
            mapHistoryItemToDisplayableTransaction(
                { id: 'TX' } as TransactionHistoryItem,
                'algorand',
            ),
        ).toThrow('No transaction history adapter is registered')
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

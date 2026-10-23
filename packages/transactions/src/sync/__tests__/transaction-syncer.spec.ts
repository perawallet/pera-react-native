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

import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
    getLatestTransactionRoundTime: vi.fn(),
    fetchTransactionHistory: vi.fn(),
    upsertTransactions: vi.fn(),
    healCachedRows: vi.fn(),
    hasCachedHistoryRows: vi.fn(),
}))

vi.mock('../../history-adapter', () => ({
    fetchTransactionHistory: mocks.fetchTransactionHistory,
    healCachedRows: mocks.healCachedRows,
    hasCachedHistoryRows: mocks.hasCachedHistoryRows,
}))

vi.mock('../../db', () => ({
    getLatestTransactionRoundTime: mocks.getLatestTransactionRoundTime,
    upsertTransactions: mocks.upsertTransactions,
}))

import { fetchAndPersistTransactions } from '../transaction-syncer'
import { LEGACY_CHAIN_ID } from '@perawallet/wallet-core-chain-contract'

const ADDRESS = 'ADDR'
const NETWORK = 'mainnet' as const

beforeEach(() => {
    // resetAllMocks (not clearAllMocks) so a stale mockResolvedValue from one
    // test cannot leak into the next; re-apply defaults explicitly afterwards.
    vi.resetAllMocks()
    mocks.getLatestTransactionRoundTime.mockResolvedValue(null)
    mocks.fetchTransactionHistory.mockResolvedValue({ transactions: [] })
    mocks.upsertTransactions.mockResolvedValue(undefined)
    mocks.healCachedRows.mockResolvedValue(undefined)
    mocks.hasCachedHistoryRows.mockReturnValue(true)
})

describe('fetchAndPersistTransactions', () => {
    it('skips a chain that keeps no cached history rows', async () => {
        mocks.hasCachedHistoryRows.mockReturnValue(false)

        await fetchAndPersistTransactions(ADDRESS, {
            chainId: LEGACY_CHAIN_ID,
            networkId: NETWORK,
        } as const)

        expect(mocks.fetchTransactionHistory).not.toHaveBeenCalled()
        expect(mocks.upsertTransactions).not.toHaveBeenCalled()
        expect(mocks.healCachedRows).not.toHaveBeenCalled()
    })

    it('does a full fetch (no afterTime) when nothing is stored yet', async () => {
        mocks.getLatestTransactionRoundTime.mockResolvedValue(null)
        mocks.fetchTransactionHistory.mockResolvedValue({
            transactions: [{ id: 'tx1' }],
        })

        await fetchAndPersistTransactions(ADDRESS, {
            chainId: LEGACY_CHAIN_ID,
            networkId: NETWORK,
        } as const)

        expect(mocks.getLatestTransactionRoundTime).toHaveBeenCalledWith({
            accountAddress: ADDRESS,
            scope: { chainId: LEGACY_CHAIN_ID, networkId: NETWORK } as const,
        })
        expect(mocks.fetchTransactionHistory).toHaveBeenCalledWith({
            accountAddress: ADDRESS,
            scope: { chainId: LEGACY_CHAIN_ID, networkId: NETWORK } as const,
            afterTime: undefined,
        })
        expect(mocks.upsertTransactions).toHaveBeenCalledWith({
            items: [{ id: 'tx1' }],
            accountAddress: ADDRESS,
            scope: { chainId: LEGACY_CHAIN_ID, networkId: NETWORK } as const,
        })
    })

    it('only fetches transactions newer than the latest stored round time', async () => {
        const latestRoundTime = 1_700_000_000 // epoch seconds
        mocks.getLatestTransactionRoundTime.mockResolvedValue(latestRoundTime)
        mocks.fetchTransactionHistory.mockResolvedValue({
            transactions: [{ id: 'tx2' }],
        })

        await fetchAndPersistTransactions(ADDRESS, {
            chainId: LEGACY_CHAIN_ID,
            networkId: NETWORK,
        } as const)

        const expectedAfterTime = new Date((latestRoundTime + 1) * 1000)
            .toISOString()
            .split('T')[0]
        expect(mocks.fetchTransactionHistory).toHaveBeenCalledWith({
            accountAddress: ADDRESS,
            scope: { chainId: LEGACY_CHAIN_ID, networkId: NETWORK } as const,
            afterTime: expectedAfterTime,
        })
        expect(mocks.upsertTransactions).toHaveBeenCalledWith({
            items: [{ id: 'tx2' }],
            accountAddress: ADDRESS,
            scope: { chainId: LEGACY_CHAIN_ID, networkId: NETWORK } as const,
        })
    })

    it('does not write to the database when the fetch returns no transactions', async () => {
        mocks.getLatestTransactionRoundTime.mockResolvedValue(null)
        mocks.fetchTransactionHistory.mockResolvedValue({ transactions: [] })

        await fetchAndPersistTransactions(ADDRESS, {
            chainId: LEGACY_CHAIN_ID,
            networkId: NETWORK,
        } as const)

        expect(mocks.upsertTransactions).not.toHaveBeenCalled()
    })

    it("runs the chain's repair of the account's cached rows", async () => {
        await fetchAndPersistTransactions(ADDRESS, {
            chainId: LEGACY_CHAIN_ID,
            networkId: NETWORK,
        } as const)

        expect(mocks.healCachedRows).toHaveBeenCalledWith(ADDRESS, {
            chainId: LEGACY_CHAIN_ID,
            networkId: NETWORK,
        } as const)
    })
})

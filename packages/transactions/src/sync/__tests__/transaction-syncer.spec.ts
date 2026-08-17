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
    backfillMissingCloseAmounts: vi.fn(),
}))

vi.mock('../../api/history', () => ({
    fetchTransactionHistory: mocks.fetchTransactionHistory,
}))

vi.mock('../../db', () => ({
    getLatestTransactionRoundTime: mocks.getLatestTransactionRoundTime,
    upsertTransactions: mocks.upsertTransactions,
}))

vi.mock('../close-amount-backfill', () => ({
    backfillMissingCloseAmounts: mocks.backfillMissingCloseAmounts,
}))

import { fetchAndPersistTransactions } from '../transaction-syncer'

const ADDRESS = 'ADDR'
const NETWORK = 'mainnet' as const

beforeEach(() => {
    // resetAllMocks (not clearAllMocks) so a stale mockResolvedValue from one
    // test cannot leak into the next; re-apply defaults explicitly afterwards.
    vi.resetAllMocks()
    mocks.getLatestTransactionRoundTime.mockResolvedValue(null)
    mocks.fetchTransactionHistory.mockResolvedValue({ transactions: [] })
    mocks.upsertTransactions.mockResolvedValue(undefined)
    mocks.backfillMissingCloseAmounts.mockResolvedValue(undefined)
})

describe('fetchAndPersistTransactions', () => {
    it('does a full fetch (no afterTime) when nothing is stored yet', async () => {
        mocks.getLatestTransactionRoundTime.mockResolvedValue(null)
        mocks.fetchTransactionHistory.mockResolvedValue({
            transactions: [{ id: 'tx1' }],
        })

        await fetchAndPersistTransactions(ADDRESS, NETWORK)

        expect(mocks.getLatestTransactionRoundTime).toHaveBeenCalledWith({
            accountAddress: ADDRESS,
            network: NETWORK,
        })
        expect(mocks.fetchTransactionHistory).toHaveBeenCalledWith({
            accountAddress: ADDRESS,
            network: NETWORK,
            afterTime: undefined,
        })
        expect(mocks.upsertTransactions).toHaveBeenCalledWith({
            items: [{ id: 'tx1' }],
            accountAddress: ADDRESS,
            network: NETWORK,
        })
    })

    it('only fetches transactions newer than the latest stored round time', async () => {
        const latestRoundTime = 1_700_000_000 // epoch seconds
        mocks.getLatestTransactionRoundTime.mockResolvedValue(latestRoundTime)
        mocks.fetchTransactionHistory.mockResolvedValue({
            transactions: [{ id: 'tx2' }],
        })

        await fetchAndPersistTransactions(ADDRESS, NETWORK)

        const expectedAfterTime = new Date((latestRoundTime + 1) * 1000)
            .toISOString()
            .split('T')[0]
        expect(mocks.fetchTransactionHistory).toHaveBeenCalledWith({
            accountAddress: ADDRESS,
            network: NETWORK,
            afterTime: expectedAfterTime,
        })
        expect(mocks.upsertTransactions).toHaveBeenCalledWith({
            items: [{ id: 'tx2' }],
            accountAddress: ADDRESS,
            network: NETWORK,
        })
    })

    it('does not write to the database when the fetch returns no transactions', async () => {
        mocks.getLatestTransactionRoundTime.mockResolvedValue(null)
        mocks.fetchTransactionHistory.mockResolvedValue({ transactions: [] })

        await fetchAndPersistTransactions(ADDRESS, NETWORK)

        expect(mocks.upsertTransactions).not.toHaveBeenCalled()
    })

    it('runs the close-amount backfill after persisting the page', async () => {
        await fetchAndPersistTransactions(ADDRESS, NETWORK)

        expect(mocks.backfillMissingCloseAmounts).toHaveBeenCalledWith({
            network: NETWORK,
        })
    })
})

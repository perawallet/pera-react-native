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

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { Decimal } from 'decimal.js'
import {
    runMigrations,
    migrations,
    type Database,
} from '@perawallet/wallet-core-database'
import { createTestDatabase } from '@perawallet/wallet-core-database/test-utils'
import { LEGACY_CHAIN_ID } from '@perawallet/wallet-core-chain-contract'
import {
    getTransactionHistory,
    historyChainAdapters,
    upsertTransactions,
    type TransactionHistoryItem,
} from '@perawallet/wallet-core-transactions'
import { algorandHistoryDataOf } from '../../history-data'
import {
    flatHistoryItem,
    type FlatHistoryItem,
} from '../../../test-utils/history-item'
import { algorandNetworkOf } from '../../../network-id'
import { fetchIndexerCloseAmount } from '../../history/indexer/endpoints'
import { backfillMissingCloseAmounts } from '../close-amount-backfill'
import { registerAlgorandHistoryCodec } from './register-history-codec'

vi.mock('../../history/indexer/endpoints', () => ({
    fetchIndexerCloseAmount: vi.fn(),
}))

const makeTx = (
    overrides: Partial<FlatHistoryItem> = {},
): TransactionHistoryItem =>
    flatHistoryItem({
        id: 'TX001',
        txType: 'pay',
        sender: 'SENDER_ADDR',
        receiver: 'RECEIVER_ADDR',
        confirmedRound: 12345,
        roundTime: 1700000000,
        fee: new Decimal(1000),
        groupId: null,
        amount: new Decimal(0),
        closeTo: 'CLOSE_ADDR',
        closeAmount: null,
        applicationId: null,
        innerTransactionCount: null,
        asset: null,
        swapGroupDetail: null,
        interpretedMeaning: null,
        balanceImpacts: [],
        ...overrides,
    })

describe('backfillMissingCloseAmounts', () => {
    let db: Database
    let teardown: () => void

    beforeEach(async () => {
        const result = createTestDatabase()
        db = result.db
        teardown = result.teardown
        await runMigrations(db, migrations)
        registerAlgorandHistoryCodec()
    })

    afterEach(() => {
        teardown()
        historyChainAdapters.reset()
    })

    it('fetches the chain value for stale close rows and heals them in place', async () => {
        await upsertTransactions({
            db,
            items: [makeTx({ id: 'TXSTALE' })],
            accountAddress: 'ACCT1',
            scope: { chainId: LEGACY_CHAIN_ID, networkId: 'mainnet' } as const,
        })
        const fetchCloseAmount = vi.fn().mockResolvedValue('50854132929')

        await backfillMissingCloseAmounts({
            db,
            scope: { chainId: LEGACY_CHAIN_ID, networkId: 'mainnet' } as const,
            accountAddress: 'ACCT1',
            fetchCloseAmount,
        })

        expect(fetchCloseAmount).toHaveBeenCalledWith('TXSTALE', {
            chainId: LEGACY_CHAIN_ID,
            networkId: 'mainnet',
        } as const)
        const [row] = await getTransactionHistory({
            db,
            accountAddress: 'ACCT1',
            scope: { chainId: LEGACY_CHAIN_ID, networkId: 'mainnet' } as const,
        })
        expect(algorandHistoryDataOf(row).closeAmount).toEqual(
            new Decimal('50854132929'),
        )
    })

    it('leaves the row unhealed (and does not throw) when the lookup fails', async () => {
        await upsertTransactions({
            db,
            items: [makeTx({ id: 'TXSTALE' })],
            accountAddress: 'ACCT1',
            scope: { chainId: LEGACY_CHAIN_ID, networkId: 'mainnet' } as const,
        })
        const fetchCloseAmount = vi.fn().mockRejectedValue(new Error('offline'))

        await expect(
            backfillMissingCloseAmounts({
                db,
                scope: {
                    chainId: LEGACY_CHAIN_ID,
                    networkId: 'mainnet',
                } as const,
                accountAddress: 'ACCT1',
                fetchCloseAmount,
            }),
        ).resolves.toBeUndefined()

        const [row] = await getTransactionHistory({
            db,
            accountAddress: 'ACCT1',
            scope: { chainId: LEGACY_CHAIN_ID, networkId: 'mainnet' } as const,
        })
        // Still null — the row keeps matching the backfill predicate, so the
        // next sync pass retries naturally.
        expect(algorandHistoryDataOf(row).closeAmount).toBeNull()
    })

    it('does not fetch anything when no rows need healing', async () => {
        await upsertTransactions({
            db,
            items: [
                makeTx({
                    id: 'TXHEALED',
                    closeAmount: new Decimal('50854132929'),
                }),
            ],
            accountAddress: 'ACCT1',
            scope: { chainId: LEGACY_CHAIN_ID, networkId: 'mainnet' } as const,
        })
        const fetchCloseAmount = vi.fn()

        await backfillMissingCloseAmounts({
            db,
            scope: { chainId: LEGACY_CHAIN_ID, networkId: 'mainnet' } as const,
            accountAddress: 'ACCT1',
            fetchCloseAmount,
        })

        expect(fetchCloseAmount).not.toHaveBeenCalled()
    })

    it('settles a row the indexer has no amount for, so it is not asked again', async () => {
        await upsertTransactions({
            db,
            items: [makeTx({ id: 'TXSTALE' })],
            accountAddress: 'ACCT1',
            scope: { chainId: LEGACY_CHAIN_ID, networkId: 'mainnet' } as const,
        })
        const fetchCloseAmount = vi.fn().mockResolvedValue(null)
        const run = () =>
            backfillMissingCloseAmounts({
                db,
                scope: {
                    chainId: LEGACY_CHAIN_ID,
                    networkId: 'mainnet',
                } as const,
                accountAddress: 'ACCT1',
                fetchCloseAmount,
            })

        await run()
        await run()

        expect(fetchCloseAmount).toHaveBeenCalledTimes(1)
        const [row] = await getTransactionHistory({
            db,
            accountAddress: 'ACCT1',
            scope: { chainId: LEGACY_CHAIN_ID, networkId: 'mainnet' } as const,
        })
        expect(algorandHistoryDataOf(row).closeAmount).toBeNull()
    })

    it('only heals the rows linked to the syncing account', async () => {
        await upsertTransactions({
            db,
            items: [makeTx({ id: 'THEIRS' })],
            accountAddress: 'ACCT2',
            scope: { chainId: LEGACY_CHAIN_ID, networkId: 'mainnet' } as const,
        })
        const fetchCloseAmount = vi.fn()

        await backfillMissingCloseAmounts({
            db,
            scope: { chainId: LEGACY_CHAIN_ID, networkId: 'mainnet' } as const,
            accountAddress: 'ACCT1',
            fetchCloseAmount,
        })

        expect(fetchCloseAmount).not.toHaveBeenCalled()
    })

    it("defaults to the indexer lookup on the scope's network", async () => {
        await upsertTransactions({
            db,
            items: [makeTx({ id: 'TXSTALE' })],
            accountAddress: 'ACCT1',
            scope: { chainId: LEGACY_CHAIN_ID, networkId: 'mainnet' } as const,
        })
        vi.mocked(fetchIndexerCloseAmount).mockResolvedValue('50854132929')

        await backfillMissingCloseAmounts({
            db,
            scope: { chainId: LEGACY_CHAIN_ID, networkId: 'mainnet' } as const,
            accountAddress: 'ACCT1',
        })

        expect(fetchIndexerCloseAmount).toHaveBeenCalledWith(
            'TXSTALE',
            algorandNetworkOf({
                chainId: LEGACY_CHAIN_ID,
                networkId: 'mainnet',
            } as const),
        )
        const [row] = await getTransactionHistory({
            db,
            accountAddress: 'ACCT1',
            scope: { chainId: LEGACY_CHAIN_ID, networkId: 'mainnet' } as const,
        })
        expect(algorandHistoryDataOf(row).closeAmount).toEqual(
            new Decimal('50854132929'),
        )
    })
})

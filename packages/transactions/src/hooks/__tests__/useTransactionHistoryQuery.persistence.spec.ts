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

// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { Decimal } from 'decimal.js'
import {
    runMigrations,
    migrations,
    type Database,
} from '@perawallet/wallet-core-database'
import { createTestDatabase } from '@perawallet/wallet-core-database/test-utils'
import { LEGACY_CHAIN_ID } from '@perawallet/wallet-core-chain-contract'
import { historyChainAdapters } from '../../history-adapter'
import {
    fixtureChainDataOf,
    fixtureHistoryAdapter,
} from '../../__tests__/fixture-chain-data'
import type { TransactionHistoryItem } from '../../models/types'

const mocks = vi.hoisted(() => ({
    db: undefined as unknown as Database,
    fetchTransactionHistory: vi.fn(),
    fetchMoreTransactions: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-database', async importActual => ({
    ...(await importActual<
        typeof import('@perawallet/wallet-core-database')
    >()),
    getDatabase: () => mocks.db,
}))

vi.mock('../../history-adapter', async importActual => ({
    ...(await importActual<typeof import('../../history-adapter')>()),
    fetchTransactionHistory: mocks.fetchTransactionHistory,
    fetchMoreTransactions: mocks.fetchMoreTransactions,
}))

// The real module reaches the accounts package, which needs a platform provider.
vi.mock('../../pending-history', () => ({ MAX_PENDING_HISTORY_ROWS: 50 }))

vi.mock('@perawallet/wallet-core-signing', () => ({
    getOpenSubmissionAttempts: vi.fn().mockResolvedValue([]),
}))

import { upsertTransactions } from '../../db'
import { useTransactionHistoryQuery } from '../useTransactionHistoryQuery'

const ADDRESS = 'ACCT1'
const scope = { chainId: LEGACY_CHAIN_ID, networkId: 'mainnet' } as const

const makeTx = (
    overrides: Partial<TransactionHistoryItem>,
): TransactionHistoryItem => ({
    id: 'TX',
    txType: 'pay',
    sender: ADDRESS,
    assetSender: null,
    receiver: 'RECEIVER_ADDR',
    confirmedRound: 12345,
    status: 'confirmed',
    roundTime: 1700000000,
    fee: new Decimal(1000),
    chainData: null,
    amount: new Decimal(5000000),
    asset: null,
    interpretedMeaning: null,
    balanceImpacts: [],
    ...overrides,
})

describe('useTransactionHistoryQuery over a migrated database', () => {
    let teardown: () => void
    let queryClient: QueryClient

    beforeEach(async () => {
        const result = createTestDatabase()
        mocks.db = result.db
        teardown = result.teardown
        await runMigrations(mocks.db, migrations)
        historyChainAdapters.register(fixtureHistoryAdapter())
        queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false } },
        })
    })

    afterEach(() => {
        teardown()
        historyChainAdapters.reset()
        vi.clearAllMocks()
    })

    it('serves close-out and swap rows exactly as they were stored', async () => {
        const swap = makeTx({
            id: 'SWAP',
            txType: 'appl',
            roundTime: 1700000001,
            amount: null,
            chainData: fixtureChainDataOf({
                swapGroupDetail: {
                    assetInId: '0',
                    assetInUnitName: 'ALGO',
                    assetInDecimals: 6,
                    assetOutId: '31566704',
                    assetOutUnitName: 'USDC',
                    assetOutDecimals: 6,
                    amountIn: new Decimal('1000000'),
                    amountOut: new Decimal('18446744073709551615'),
                },
            }),
        })
        const close = makeTx({
            id: 'CLOSE',
            amount: new Decimal(0),
            chainData: fixtureChainDataOf({
                closeTo: 'CLOSE_ADDR',
                closeAmount: new Decimal('50854132929'),
            }),
        })
        await upsertTransactions({
            items: [close, swap],
            accountAddress: ADDRESS,
            scope,
        })

        const { result } = renderHook(
            () =>
                useTransactionHistoryQuery({ accountAddress: ADDRESS, scope }),
            {
                wrapper: ({ children }: { children: React.ReactNode }) =>
                    React.createElement(
                        QueryClientProvider,
                        { client: queryClient },
                        children,
                    ),
            },
        )

        await waitFor(() => expect(result.current.isLoading).toBe(false))

        expect(result.current.transactions).toEqual([swap, close])
        expect(mocks.fetchTransactionHistory).not.toHaveBeenCalled()
    })
})

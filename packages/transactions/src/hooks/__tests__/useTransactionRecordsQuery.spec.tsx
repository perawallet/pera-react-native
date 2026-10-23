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

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import {
    QueryClient,
    QueryClientProvider,
    onlineManager,
} from '@tanstack/react-query'
import React from 'react'
import { Decimal } from 'decimal.js'
import {
    i18nKey,
    type ChainScope,
    type TransactionRecord,
} from '@perawallet/wallet-core-chain-contract'
import {
    MAX_RECORD_PAGE_READS,
    useTransactionRecordsQuery,
} from '../useTransactionRecordsQuery'

const mocks = vi.hoisted(() => ({
    getTransactionHistoryWithPending: vi.fn(),
    getPendingTransactionRecords: vi.fn(),
}))

// The real module reaches the accounts package, which needs a platform provider.
vi.mock('../../pending-history', () => mocks)

const ADDRESS = '0xabc'
const SCOPE: ChainScope = { chainId: 'ethereum', networkId: 'mainnet' }
const USDC = '0xusdc'

const record = (
    id: string,
    timestamp: number | undefined,
    assetId = '0',
): TransactionRecord => ({
    id,
    scope: SCOPE,
    status: timestamp === undefined ? 'pending' : 'confirmed',
    timestamp,
    summary: {
        kind: 'transfer',
        title: { key: i18nKey('transactions.list_item.send') },
        direction: 'out',
        amount: {
            assetRef: { chainId: 'ethereum', assetId },
            value: new Decimal(1),
        },
        icon: 'send',
    },
    chainData: { family: 'evm' },
})

const DAY_MS = 86_400_000
const JAN_10 = Date.parse('2026-01-10T12:00:00Z')

describe('useTransactionRecordsQuery', () => {
    let queryClient: QueryClient
    let wrapper: React.FC<{ children: React.ReactNode }>

    beforeEach(() => {
        vi.resetAllMocks()
        onlineManager.setOnline(true)
        queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false } },
        })
        wrapper = ({ children }) => (
            <QueryClientProvider client={queryClient}>
                {children}
            </QueryClientProvider>
        )
    })

    afterEach(() => {
        onlineManager.setOnline(true)
        queryClient.clear()
    })

    test('lists records newest first and pages on the backend cursor', async () => {
        mocks.getTransactionHistoryWithPending
            .mockResolvedValueOnce({
                items: [record('B', JAN_10), record('A', JAN_10 - DAY_MS)],
                next: { cursor: 'c1' },
            })
            .mockResolvedValueOnce({
                items: [record('Z', JAN_10 - 2 * DAY_MS)],
            })

        const { result } = renderHook(
            () =>
                useTransactionRecordsQuery({
                    accountAddress: ADDRESS,
                    scope: SCOPE,
                }),
            { wrapper },
        )

        await waitFor(() => expect(result.current.records).toHaveLength(2))
        expect(result.current.hasNextPage).toBe(true)

        act(() => result.current.fetchNextPage())

        await waitFor(() =>
            expect(result.current.records.map(r => r.id)).toEqual([
                'B',
                'A',
                'Z',
            ]),
        )
        expect(mocks.getTransactionHistoryWithPending).toHaveBeenLastCalledWith(
            ADDRESS,
            SCOPE,
            { cursor: 'c1' },
        )
        expect(result.current.hasNextPage).toBe(false)
    })

    test('reads past pages with nothing to show instead of settling on an empty one', async () => {
        mocks.getTransactionHistoryWithPending
            .mockResolvedValueOnce({ items: [], next: { cursor: 'c1' } })
            .mockResolvedValueOnce({
                items: [record('A', JAN_10)],
                next: { cursor: 'c2' },
            })

        const { result } = renderHook(
            () =>
                useTransactionRecordsQuery({
                    accountAddress: ADDRESS,
                    scope: SCOPE,
                }),
            { wrapper },
        )

        await waitFor(() =>
            expect(result.current.records.map(r => r.id)).toEqual(['A']),
        )
        expect(mocks.getTransactionHistoryWithPending).toHaveBeenCalledTimes(2)
        expect(result.current.hasNextPage).toBe(true)
    })

    test('reads at most the cap per fetch, then asks for the next page itself', async () => {
        for (let i = 1; i <= MAX_RECORD_PAGE_READS; i++) {
            mocks.getTransactionHistoryWithPending.mockResolvedValueOnce({
                items: [],
                next: { cursor: `c${i}` },
            })
        }
        mocks.getTransactionHistoryWithPending.mockResolvedValueOnce({
            items: [record('A', JAN_10)],
        })

        const { result } = renderHook(
            () =>
                useTransactionRecordsQuery({
                    accountAddress: ADDRESS,
                    scope: SCOPE,
                }),
            { wrapper },
        )

        await waitFor(() =>
            expect(result.current.records.map(r => r.id)).toEqual(['A']),
        )
        expect(queryClient.getQueryCache().getAll()[0].state.data).toEqual(
            expect.objectContaining({
                pages: [
                    {
                        records: [],
                        next: { cursor: `c${MAX_RECORD_PAGE_READS}` },
                    },
                    { records: [record('A', JAN_10)], next: null },
                ],
            }),
        )
        expect(mocks.getTransactionHistoryWithPending).toHaveBeenLastCalledWith(
            ADDRESS,
            SCOPE,
            { cursor: `c${MAX_RECORD_PAGE_READS}` },
        )
    })

    test('stops asking for pages after a failed one until a retry', async () => {
        for (let i = 1; i <= MAX_RECORD_PAGE_READS; i++) {
            mocks.getTransactionHistoryWithPending.mockResolvedValueOnce({
                items: [],
                next: { cursor: `c${i}` },
            })
        }
        mocks.getTransactionHistoryWithPending.mockRejectedValueOnce(
            new Error('history service refused'),
        )

        const { result } = renderHook(
            () =>
                useTransactionRecordsQuery({
                    accountAddress: ADDRESS,
                    scope: SCOPE,
                }),
            { wrapper },
        )

        await waitFor(() => expect(result.current.isError).toBe(true))
        const callsAtFailure =
            mocks.getTransactionHistoryWithPending.mock.calls.length
        expect(callsAtFailure).toBe(MAX_RECORD_PAGE_READS + 1)
        expect(result.current.hasNextPage).toBe(true)

        mocks.getTransactionHistoryWithPending.mockResolvedValueOnce({
            items: [record('A', JAN_10)],
        })
        act(() => result.current.fetchNextPage())

        await waitFor(() =>
            expect(result.current.records.map(r => r.id)).toEqual(['A']),
        )
        expect(mocks.getTransactionHistoryWithPending).toHaveBeenCalledTimes(
            callsAtFailure + 1,
        )
    })

    test('keeps fetchNextPage and refetch stable across renders', async () => {
        mocks.getTransactionHistoryWithPending.mockResolvedValue({
            items: [record('A', JAN_10)],
        })

        const { result, rerender } = renderHook(
            () =>
                useTransactionRecordsQuery({
                    accountAddress: ADDRESS,
                    scope: SCOPE,
                }),
            { wrapper },
        )
        await waitFor(() => expect(result.current.records).toHaveLength(1))
        const { fetchNextPage, refetch } = result.current

        rerender()

        expect(result.current.fetchNextPage).toBe(fetchNextPage)
        expect(result.current.refetch).toBe(refetch)
    })

    test('keeps only records that move the filtered asset', async () => {
        mocks.getTransactionHistoryWithPending
            .mockResolvedValueOnce({
                items: [record('ETH', JAN_10)],
                next: { cursor: 'c1' },
            })
            .mockResolvedValueOnce({
                items: [
                    record('USDC', JAN_10 - DAY_MS, USDC),
                    record('ETH2', JAN_10 - DAY_MS),
                ],
            })

        const { result } = renderHook(
            () =>
                useTransactionRecordsQuery({
                    accountAddress: ADDRESS,
                    scope: SCOPE,
                    assetId: USDC,
                }),
            { wrapper },
        )

        await waitFor(() =>
            expect(result.current.records.map(r => r.id)).toEqual(['USDC']),
        )
        expect(result.current.hasNextPage).toBe(false)
    })

    test('keeps the date range inclusive and stops paging once it passes its start', async () => {
        mocks.getTransactionHistoryWithPending.mockResolvedValueOnce({
            items: [
                record('JAN11', JAN_10 + DAY_MS),
                record('JAN10', JAN_10),
                record('JAN9', JAN_10 - DAY_MS),
                record('PENDING', undefined),
            ],
            next: { cursor: 'c1' },
        })

        const { result } = renderHook(
            () =>
                useTransactionRecordsQuery({
                    accountAddress: ADDRESS,
                    scope: SCOPE,
                    afterTime: '2026-01-10',
                    beforeTime: '2026-01-10',
                }),
            { wrapper },
        )

        await waitFor(() =>
            expect(result.current.records.map(r => r.id)).toEqual([
                'JAN10',
                'PENDING',
            ]),
        )
        expect(result.current.hasNextPage).toBe(false)
    })

    test('shows only the wallet’s own sends while offline', async () => {
        onlineManager.setOnline(false)
        mocks.getPendingTransactionRecords.mockResolvedValueOnce([
            record('SENT', undefined),
        ])

        const { result } = renderHook(
            () =>
                useTransactionRecordsQuery({
                    accountAddress: ADDRESS,
                    scope: SCOPE,
                }),
            { wrapper },
        )

        await waitFor(() =>
            expect(result.current.records.map(r => r.id)).toEqual(['SENT']),
        )
        expect(mocks.getTransactionHistoryWithPending).not.toHaveBeenCalled()
        expect(result.current.hasNextPage).toBe(false)
    })

    test('reports a failed read as an error', async () => {
        const failure = new Error('history service refused')
        mocks.getTransactionHistoryWithPending.mockRejectedValueOnce(failure)

        const { result } = renderHook(
            () =>
                useTransactionRecordsQuery({
                    accountAddress: ADDRESS,
                    scope: SCOPE,
                }),
            { wrapper },
        )

        await waitFor(() => expect(result.current.isError).toBe(true))
        expect(result.current.error).toBe(failure)
        expect(result.current.records).toEqual([])
    })

    test('stays idle without an address', () => {
        renderHook(
            () =>
                useTransactionRecordsQuery({
                    accountAddress: '',
                    scope: SCOPE,
                }),
            { wrapper },
        )

        expect(mocks.getTransactionHistoryWithPending).not.toHaveBeenCalled()
    })
})

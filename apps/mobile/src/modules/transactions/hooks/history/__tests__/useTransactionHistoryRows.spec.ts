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
import { act, renderHook } from '@testing-library/react'
import {
    hasCachedHistoryRows,
    useTransactionHistoryQuery,
    useTransactionRecordsQuery,
    type UseTransactionHistoryQueryResult,
    type UseTransactionRecordsQueryResult,
} from '@perawallet/wallet-core-transactions'
import type { TransactionRecord } from '@perawallet/wallet-core-chain-contract'
import { useTransactionHistoryRows } from '../useTransactionHistoryRows'

vi.mock('@perawallet/wallet-core-transactions', () => ({
    hasCachedHistoryRows: vi.fn(),
    useTransactionHistoryQuery: vi.fn(),
    useTransactionRecordsQuery: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-shared', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-shared')
    >()),
    formatISODate: (date: Date) => date.toISOString().split('T')[0],
}))

const historyResult = (
    overrides: Partial<UseTransactionHistoryQueryResult> = {},
): UseTransactionHistoryQueryResult => ({
    transactions: [],
    isLoading: false,
    isFetched: true,
    isFetchingNextPage: false,
    isError: false,
    isPaused: false,
    error: null,
    hasNextPage: false,
    fetchNextPage: vi.fn(),
    refetch: vi.fn(),
    ...overrides,
})

const recordsResult = (
    overrides: Partial<UseTransactionRecordsQueryResult> = {},
): UseTransactionRecordsQueryResult => ({
    records: [],
    isLoading: false,
    isFetched: true,
    isFetchingNextPage: false,
    isError: false,
    error: null,
    hasNextPage: false,
    fetchNextPage: vi.fn(),
    refetch: vi.fn(),
    ...overrides,
})

const ETH_SCOPE = { chainId: 'ethereum', networkId: 'mainnet' } as const

describe('useTransactionHistoryRows', () => {
    beforeEach(() => {
        vi.resetAllMocks()
        vi.mocked(useTransactionHistoryQuery).mockReturnValue(historyResult())
        vi.mocked(useTransactionRecordsQuery).mockReturnValue(recordsResult())
    })

    it('reads records, with only the records query enabled, on a chain without cached rows', () => {
        vi.mocked(hasCachedHistoryRows).mockReturnValue(false)
        const record = {
            id: '0xhash',
            timestamp: 1_704_067_200_000,
        } as TransactionRecord
        vi.mocked(useTransactionRecordsQuery).mockReturnValue(
            recordsResult({ records: [record] }),
        )

        const { result } = renderHook(() =>
            useTransactionHistoryRows({
                accountAddress: '0xabc',
                scope: ETH_SCOPE,
                assetId: '0xusdc',
            }),
        )

        expect(useTransactionHistoryQuery).toHaveBeenCalledWith(
            expect.objectContaining({ isEnabled: false }),
        )
        expect(useTransactionRecordsQuery).toHaveBeenCalledWith(
            expect.objectContaining({
                accountAddress: '0xabc',
                assetId: '0xusdc',
                isEnabled: true,
            }),
        )
        expect(result.current.rows.map(row => row.kind)).toEqual([
            'header',
            'record',
        ])
        expect(result.current.transactionCount).toBe(1)
    })

    it('reads cached rows on a chain that keeps them', () => {
        vi.mocked(hasCachedHistoryRows).mockReturnValue(true)

        renderHook(() =>
            useTransactionHistoryRows({
                accountAddress: 'ALGO',
                scope: { chainId: 'algorand', networkId: 'mainnet' },
            }),
        )

        expect(useTransactionHistoryQuery).toHaveBeenCalledWith(
            expect.objectContaining({ isEnabled: true }),
        )
        expect(useTransactionRecordsQuery).toHaveBeenCalledWith(
            expect.objectContaining({ isEnabled: false }),
        )
    })

    it('enables neither query without an address', () => {
        vi.mocked(hasCachedHistoryRows).mockReturnValue(false)

        renderHook(() => useTransactionHistoryRows({ scope: ETH_SCOPE }))

        expect(useTransactionRecordsQuery).toHaveBeenCalledWith(
            expect.objectContaining({ accountAddress: '', isEnabled: false }),
        )
    })

    it('retries the next page after a failed one, and the first page otherwise', () => {
        vi.mocked(hasCachedHistoryRows).mockReturnValue(false)
        const failedNext = recordsResult({ isError: true, hasNextPage: true })
        vi.mocked(useTransactionRecordsQuery).mockReturnValue(failedNext)

        const { result, rerender } = renderHook(() =>
            useTransactionHistoryRows({
                accountAddress: '0xabc',
                scope: ETH_SCOPE,
            }),
        )
        act(() => result.current.retry())
        expect(failedNext.fetchNextPage).toHaveBeenCalledTimes(1)

        const failedFirst = recordsResult({ isError: true })
        vi.mocked(useTransactionRecordsQuery).mockReturnValue(failedFirst)
        rerender()
        act(() => result.current.retry())
        expect(failedFirst.refetch).toHaveBeenCalledTimes(1)
    })
})

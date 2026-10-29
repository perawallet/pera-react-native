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
import { renderHook } from '@testing-library/react'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import {
    useTransactionHistoryRows,
    type UseTransactionHistoryRowsResult,
} from '../../../hooks/history/useTransactionHistoryRows'
import { useTransactionHistoryFeed } from '../useTransactionHistoryFeed'

vi.mock('../../../hooks/history/useTransactionHistoryRows', () => ({
    useTransactionHistoryRows: vi.fn(),
}))

const mockRefresh = vi.hoisted(() => vi.fn())
vi.mock('@hooks/useSyncRefresh', () => ({
    useSyncRefresh: () => ({ isRefreshing: false, refresh: mockRefresh }),
}))

const ETHEREUM: ChainScope = { chainId: 'ethereum', networkId: 'mainnet' }
const SOURCE = { scope: ETHEREUM, address: '0xaaa' }

const rowsResult = (
    overrides: Partial<UseTransactionHistoryRowsResult> = {},
): UseTransactionHistoryRowsResult => ({
    rows: [],
    transactionCount: 0,
    isLoading: false,
    isFetched: true,
    isFetchingNextPage: false,
    isError: false,
    error: null,
    isLoadFailed: false,
    isLoadUnavailable: false,
    isLoadIntegrityBlocked: false,
    hasNextPage: false,
    isSearchPaused: false,
    fetchNextPage: vi.fn(),
    retry: vi.fn(),
    isRetrying: false,
    suspectedPoisoningById: new Map(),
    ...overrides,
})

describe('useTransactionHistoryFeed', () => {
    const onChange = vi.fn()

    beforeEach(() => {
        vi.clearAllMocks()
        vi.mocked(useTransactionHistoryRows).mockReturnValue(rowsResult())
    })

    const renderFeed = (afterTime?: string) =>
        renderHook(
            ({ after }) =>
                useTransactionHistoryFeed({
                    feedKey: 'ethereum:0xaaa',
                    source: SOURCE,
                    afterTime: after,
                    onChange,
                }),
            { initialProps: { after: afterTime } },
        )

    it("reads the source's history with the filters and reports it under its key", () => {
        renderFeed('2024-01-01')

        expect(useTransactionHistoryRows).toHaveBeenCalledWith({
            accountAddress: '0xaaa',
            scope: ETHEREUM,
            afterTime: '2024-01-01',
            beforeTime: undefined,
        })
        expect(onChange).toHaveBeenLastCalledWith(
            'ethereum:0xaaa',
            expect.objectContaining({ scope: ETHEREUM, hasNextPage: false }),
            expect.anything(),
        )
    })

    it('reports again only when what it reads changes', () => {
        const { rerender } = renderFeed()
        const reports = onChange.mock.calls.length

        rerender({ after: undefined })
        expect(onChange).toHaveBeenCalledTimes(reports)

        vi.mocked(useTransactionHistoryRows).mockReturnValue(
            rowsResult({ hasNextPage: true }),
        )
        rerender({ after: undefined })
        expect(onChange).toHaveBeenLastCalledWith(
            'ethereum:0xaaa',
            expect.objectContaining({ hasNextPage: true }),
            expect.anything(),
        )
    })

    it("routes its actions to the latest query's functions, which change every render", () => {
        const { rerender } = renderFeed()
        const actions = onChange.mock.lastCall![2]
        const latest = rowsResult()
        vi.mocked(useTransactionHistoryRows).mockReturnValue(latest)
        rerender({ after: undefined })

        actions.fetchNextPage()
        actions.retry()
        actions.refresh()

        expect(latest.fetchNextPage).toHaveBeenCalledTimes(1)
        expect(latest.retry).toHaveBeenCalledTimes(1)
        expect(mockRefresh).toHaveBeenCalledTimes(1)
    })

    it('withdraws its snapshot on unmount', () => {
        const { unmount } = renderFeed()

        unmount()

        expect(onChange).toHaveBeenLastCalledWith(
            'ethereum:0xaaa',
            null,
            expect.anything(),
        )
    })
})

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

import { describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import type {
    ChainScope,
    TransactionRecord,
} from '@perawallet/wallet-core-chain-contract'
import type { HistoryFeedSnapshot } from '../../../utils/mergeHistoryFeeds'
import { buildRecordListRows } from '../../../utils/transactionListRows'
import {
    useMergedTransactionHistoryRows,
    type HistoryFeedActions,
    type HistoryFeedSource,
} from '../useMergedTransactionHistoryRows'

vi.mock('@perawallet/wallet-core-shared', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-shared')
    >()),
    formatISODate: (date: Date) => date.toISOString().split('T')[0],
}))

const ETHEREUM: ChainScope = { chainId: 'ethereum', networkId: 'mainnet' }
const BASE: ChainScope = { chainId: 'base', networkId: 'mainnet' }
const SOURCES: HistoryFeedSource[] = [
    { scope: ETHEREUM, address: '0xaaa' },
    { scope: BASE, address: '0xaaa' },
]

const recordAt = (id: string, scope: ChainScope, timestamp: number) =>
    ({ id, scope, timestamp }) as TransactionRecord

const snapshot = (
    scope: ChainScope,
    records: TransactionRecord[],
    overrides: Partial<HistoryFeedSnapshot> = {},
): HistoryFeedSnapshot => ({
    scope,
    rows: buildRecordListRows(records),
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
    isRetrying: false,
    isRefreshing: false,
    suspectedPoisoningById: new Map(),
    ...overrides,
})

const makeActions = (): HistoryFeedActions => ({
    fetchNextPage: vi.fn(),
    retry: vi.fn(),
    refresh: vi.fn(),
})

const entryKeys = (
    rows: ReturnType<typeof useMergedTransactionHistoryRows>['rows'],
) => rows.filter(row => row.kind !== 'header').map(row => row.key)

describe('useMergedTransactionHistoryRows', () => {
    it('offers one feed per source with the filters, and none when there are no sources', () => {
        const { result, rerender } = renderHook(
            ({ sources }) =>
                useMergedTransactionHistoryRows({
                    sources,
                    afterTime: '2024-01-01',
                }),
            { initialProps: { sources: SOURCES } },
        )

        expect(
            result.current.feeds.map(({ source, afterTime }) => ({
                chainId: source.scope.chainId,
                afterTime,
            })),
        ).toEqual([
            { chainId: 'ethereum', afterTime: '2024-01-01' },
            { chainId: 'base', afterTime: '2024-01-01' },
        ])

        rerender({ sources: [] })

        expect(result.current.feeds).toEqual([])
    })

    it('merges what the feeds report and drops a feed that withdraws', () => {
        const { result } = renderHook(() =>
            useMergedTransactionHistoryRows({ sources: SOURCES }),
        )
        const [ethereumFeed, baseFeed] = result.current.feeds

        act(() => {
            ethereumFeed!.onChange(
                ethereumFeed!.feedKey,
                snapshot(ETHEREUM, [recordAt('eth', ETHEREUM, 1000)]),
                makeActions(),
            )
            baseFeed!.onChange(
                baseFeed!.feedKey,
                snapshot(BASE, [recordAt('base', BASE, 2000)]),
                makeActions(),
            )
        })

        expect(entryKeys(result.current.rows)).toEqual(['base', 'eth'])
        expect(result.current.isFetched).toBe(true)

        act(() => {
            baseFeed!.onChange(baseFeed!.feedKey, null, makeActions())
        })

        expect(result.current.rows).toEqual([])
        expect(result.current.isFetched).toBe(false)
    })

    it('loads more only from the network holding the list back', () => {
        const { result } = renderHook(() =>
            useMergedTransactionHistoryRows({ sources: SOURCES }),
        )
        const [ethereumFeed, baseFeed] = result.current.feeds
        const ethereumActions = makeActions()
        const baseActions = makeActions()

        act(() => {
            ethereumFeed!.onChange(
                ethereumFeed!.feedKey,
                snapshot(ETHEREUM, [recordAt('eth', ETHEREUM, 1000)], {
                    hasNextPage: true,
                }),
                ethereumActions,
            )
            baseFeed!.onChange(
                baseFeed!.feedKey,
                snapshot(BASE, [recordAt('base', BASE, 2000)], {
                    hasNextPage: true,
                }),
                baseActions,
            )
        })
        act(() => result.current.fetchNextPage())

        expect(baseActions.fetchNextPage).toHaveBeenCalledTimes(1)
        expect(ethereumActions.fetchNextPage).not.toHaveBeenCalled()
    })

    it('resumes paused networks, retries failed ones and refreshes all', () => {
        const { result } = renderHook(() =>
            useMergedTransactionHistoryRows({ sources: SOURCES }),
        )
        const [ethereumFeed, baseFeed] = result.current.feeds
        const ethereumActions = makeActions()
        const baseActions = makeActions()

        act(() => {
            ethereumFeed!.onChange(
                ethereumFeed!.feedKey,
                snapshot(ETHEREUM, [], {
                    hasNextPage: true,
                    isSearchPaused: true,
                }),
                ethereumActions,
            )
            baseFeed!.onChange(
                baseFeed!.feedKey,
                snapshot(BASE, [], { isError: true }),
                baseActions,
            )
        })
        act(() => {
            result.current.searchOlder()
            result.current.retry()
            result.current.refresh()
        })

        expect(ethereumActions.fetchNextPage).toHaveBeenCalledTimes(1)
        expect(baseActions.fetchNextPage).not.toHaveBeenCalled()
        expect(baseActions.retry).toHaveBeenCalledTimes(1)
        expect(ethereumActions.retry).not.toHaveBeenCalled()
        expect(ethereumActions.refresh).toHaveBeenCalledTimes(1)
        expect(baseActions.refresh).toHaveBeenCalledTimes(1)
    })
})

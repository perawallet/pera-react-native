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
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { registerEthereumChain } from '@test-utils/chain-fixtures'
import {
    useMergedTransactionHistoryRows,
    useTransactionHistoryRows,
    type UseMergedTransactionHistoryRowsResult,
    type UseTransactionHistoryRowsResult,
} from '@modules/transactions'
import { useAssetListViewStore } from '../../../hooks/useAssetListViewStore'
import { useAccountHistoryRows } from '../useAccountHistoryRows'

const mockSources = vi.hoisted(() => ({ current: [] as unknown[] }))

vi.mock('@perawallet/wallet-core-accounts', async () => ({
    ...(await vi.importActual<object>(
        '@packages/accounts/src/models/accounts',
    )),
    useSelectedAccount: () => ({
        chains: { algorand: { address: 'ALGO_ADDRESS' } },
    }),
    useAccountHoldingSources: () => mockSources.current,
    useAccountScope: () => ALGORAND,
    addressOn: () => 'ALGO_ADDRESS',
}))

vi.mock('@modules/transactions', () => ({
    useTransactionHistoryRows: vi.fn(),
    useMergedTransactionHistoryRows: vi.fn(),
}))

const mockSingleRefresh = vi.hoisted(() => vi.fn())
vi.mock('@hooks/useSyncRefresh', () => ({
    useSyncRefresh: () => ({ isRefreshing: false, refresh: mockSingleRefresh }),
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: (key: string) => key }),
}))

const ALGORAND: ChainScope = { chainId: 'algorand', networkId: 'mainnet' }
const ETHEREUM: ChainScope = { chainId: 'ethereum', networkId: 'mainnet' }
const TWO_NETWORKS = [
    { address: 'ALGO_ADDRESS', scope: ALGORAND },
    { address: '0xaaa', scope: ETHEREUM },
]

const history = (
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

const mergedHistory = (
    overrides: Partial<UseMergedTransactionHistoryRowsResult> = {},
): UseMergedTransactionHistoryRowsResult => ({
    ...history(),
    isRefreshing: false,
    scopeByTransactionId: new Map(),
    failedChainIds: [],
    feeds: [],
    searchOlder: vi.fn(),
    refresh: vi.fn(),
    ...overrides,
})

describe('useAccountHistoryRows', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        registerEthereumChain()
        mockSources.current = []
        useAssetListViewStore.setState({ selectedChainId: null })
        vi.mocked(useTransactionHistoryRows).mockReturnValue(history())
        vi.mocked(useMergedTransactionHistoryRows).mockReturnValue(
            mergedHistory(),
        )
    })

    it("reads a single-network account's own chain, merging nothing", () => {
        const { result } = renderHook(() => useAccountHistoryRows({}))

        expect(result.current.isMerged).toBe(false)
        expect(useTransactionHistoryRows).toHaveBeenCalledWith(
            expect.objectContaining({ accountAddress: 'ALGO_ADDRESS' }),
        )
        expect(useMergedTransactionHistoryRows).toHaveBeenCalledWith(
            expect.objectContaining({ sources: [] }),
        )

        act(() => result.current.handleRefresh())
        expect(mockSingleRefresh).toHaveBeenCalledTimes(1)
    })

    it('merges every network on All and routes paging, refresh and row scopes to the merge', () => {
        mockSources.current = TWO_NETWORKS
        const merged = mergedHistory({
            hasNextPage: true,
            scopeByTransactionId: new Map([['0xhash', ETHEREUM]]),
        })
        vi.mocked(useMergedTransactionHistoryRows).mockReturnValue(merged)

        const { result } = renderHook(() => useAccountHistoryRows({}))

        expect(result.current.isMerged).toBe(true)
        expect(useTransactionHistoryRows).toHaveBeenCalledWith(
            expect.objectContaining({ accountAddress: undefined }),
        )
        expect(useMergedTransactionHistoryRows).toHaveBeenCalledWith(
            expect.objectContaining({ sources: TWO_NETWORKS }),
        )

        act(() => {
            result.current.handleLoadMore()
            result.current.handleRefresh()
        })

        expect(merged.fetchNextPage).toHaveBeenCalledTimes(1)
        expect(merged.refresh).toHaveBeenCalledTimes(1)
        expect(mockSingleRefresh).not.toHaveBeenCalled()
        expect(result.current.scopeOf('0xhash')).toBe(ETHEREUM)
        expect(result.current.scopeOf('unknown')).toEqual(ALGORAND)
    })

    it('hands Load More to the merge even while a network is busy, since the merge queues it', () => {
        mockSources.current = TWO_NETWORKS
        const merged = mergedHistory({
            hasNextPage: true,
            isFetchingNextPage: true,
        })
        vi.mocked(useMergedTransactionHistoryRows).mockReturnValue(merged)

        const { result } = renderHook(() => useAccountHistoryRows({}))
        act(() => result.current.handleLoadMore())

        expect(merged.fetchNextPage).toHaveBeenCalledTimes(1)
    })

    it('drops Load More on a single network while a page is in flight', () => {
        const single = history({ hasNextPage: true, isFetchingNextPage: true })
        vi.mocked(useTransactionHistoryRows).mockReturnValue(single)

        const { result } = renderHook(() => useAccountHistoryRows({}))
        act(() => result.current.handleLoadMore())

        expect(single.fetchNextPage).not.toHaveBeenCalled()
    })

    it('names networks that failed while others show, and leaves a total failure to the load-failed state', () => {
        mockSources.current = TWO_NETWORKS
        vi.mocked(useMergedTransactionHistoryRows).mockReturnValue(
            mergedHistory({ failedChainIds: ['ethereum'] }),
        )

        const { result, rerender } = renderHook(() => useAccountHistoryRows({}))

        expect(result.current.failedNetworkNames).toEqual(['Ethereum'])

        vi.mocked(useMergedTransactionHistoryRows).mockReturnValue(
            mergedHistory({ failedChainIds: ['ethereum'], isLoadFailed: true }),
        )
        rerender()

        expect(result.current.failedNetworkNames).toEqual([])
    })

    it('reads only the chip network once one is picked', () => {
        mockSources.current = TWO_NETWORKS

        const { result } = renderHook(() => useAccountHistoryRows({}))
        act(() => result.current.handleSelectChain('ethereum'))

        expect(result.current.isMerged).toBe(false)
        expect(result.current.networkChainId).toBe('ethereum')
        expect(useTransactionHistoryRows).toHaveBeenLastCalledWith(
            expect.objectContaining({
                accountAddress: '0xaaa',
                scope: ETHEREUM,
            }),
        )
    })
})

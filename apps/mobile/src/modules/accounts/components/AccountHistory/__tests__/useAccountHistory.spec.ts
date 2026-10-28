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
import { renderHook, act } from '@testing-library/react'
const mockScopeNetwork = vi.hoisted(() => ({ current: 'mainnet' }))

import { useAccountHistory } from '../useAccountHistory'
import { useSelectedAccount } from '@perawallet/wallet-core-accounts'
import { getSyncService } from '@perawallet/wallet-core-background'
import { registerEthereumChain } from '@test-utils/chain-fixtures'
import {
    useChainCapability,
    useIsCapabilityRestricted,
} from '@perawallet/wallet-core-chain-shared'
import {
    historyChainAdapters,
    useCsvExportMutation,
    useTransactionHistoryQuery,
    useTransactionRecordsQuery,
    type TransactionHistoryItem,
} from '@perawallet/wallet-core-transactions'
import {
    i18nKey,
    type TransactionRecord,
} from '@perawallet/wallet-core-chain-contract'
import {
    algorandHistoryAdapter,
    EMPTY_ALGORAND_HISTORY_DATA,
} from '@perawallet/wallet-core-chain-algorand/transactions'
import { Decimal } from 'decimal.js'
import { shareFile } from '@utils/shareFile'
import { useToast } from '@hooks/useToast'
import { TransactionFilter } from '../../TransactionsFilterContent/types'
import { useErrorToast } from '@hooks/useErrorToast'
import {
    AppError,
    IntegrityRequiredError,
    isPeraServiceUnavailableError,
    PeraServiceUnavailableError,
} from '@perawallet/wallet-core-shared'
import { AccountDetailsEvent, AnalyticsMetadataKey } from '@analytics'

const mockTrackEvent = vi.hoisted(() => vi.fn())
vi.mock('@analytics', async () => ({
    ...(await vi.importActual<object>('@analytics')),
    trackEvent: mockTrackEvent,
}))

const mockRequestBottomSheet = vi.fn()
vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheet: () => ({ request: mockRequestBottomSheet }),
}))

const mockUseNetworkStatus = vi.hoisted(() => vi.fn())
vi.mock('@modules/network', () => ({
    useNetworkStatus: mockUseNetworkStatus,
}))

// Mock dependencies
vi.mock('@perawallet/wallet-core-accounts', async () => ({
    // Real enums (models/accounts has no runtime imports): components reached
    // through module barrels read them at import time.
    ...(await vi.importActual<object>(
        '@packages/accounts/src/models/accounts',
    )),
    useSelectedAccount: vi.fn(),
    useAccountScope: (account: { chains: Record<string, unknown> } | null) => ({
        chainId: Object.keys(account?.chains ?? {})[0] ?? 'algorand',
        networkId: mockScopeNetwork.current,
    }),
    addressOn: (account: { chains: Record<string, { address: string }> }) =>
        Object.values(account.chains)[0]?.address,
}))

vi.mock(
    '@perawallet/wallet-core-chain-algorand/blockchain',
    async importOriginal => ({
        ...(await importOriginal<
            typeof import('@perawallet/wallet-core-chain-algorand/blockchain')
        >()),
    }),
)

// The capability hooks stay real unless a case overrides them, so a chain's
// own build decides what the history offers.
vi.mock('@perawallet/wallet-core-chain-shared', async importOriginal => {
    const actual =
        await importOriginal<
            typeof import('@perawallet/wallet-core-chain-shared')
        >()
    return {
        ...actual,
        useChainCapability: vi.fn(actual.useChainCapability),
        useIsCapabilityRestricted: vi.fn(actual.useIsCapabilityRestricted),
    }
})

vi.mock('@modules/transactions/hooks/address-safety/useKnownAddresses', () => ({
    useKnownAddresses: () => ({
        knownAddresses: [],
        isPending: false,
        hasSenderHistory: true,
    }),
}))

vi.mock('@perawallet/wallet-core-transactions', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-transactions')
    >()),
    useSuspectedPoisoningQuery: () => ({ data: new Map() }),
    // The fixtures carry only what the list reads; the poisoning check is stubbed above.
    summarizeHistoryItem: () => ({
        kind: 'chain-specific',
        title: { key: 'title' },
        direction: 'none',
        icon: 'unknown',
    }),
    useTransactionHistoryQuery: vi.fn(),
    useTransactionRecordsQuery: vi.fn(),
    useCsvExportMutation: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-background', () => ({
    getSyncService: vi.fn(),
}))

vi.mock('@hooks/useToast', () => ({
    useToast: vi.fn(),
}))

vi.mock('@hooks/useErrorToast', () => ({
    useErrorToast: vi.fn(),
}))

vi.mock('@hooks/useNodeErrorMessage', () => ({
    useNodeErrorMessage: () => ({ getMessage: vi.fn() }),
}))

vi.mock('@hooks/useLanguage')

const mockNavigate = vi.fn()
vi.mock('@react-navigation/native', () => ({
    useNavigation: () => ({
        navigate: mockNavigate,
    }),
}))

vi.mock('react-native', () => ({
    Platform: {
        OS: 'ios',
        select: vi.fn(),
    },
}))

vi.mock('@utils/shareFile', () => ({
    shareFile: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-shared', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@perawallet/wallet-core-shared')>()
    return {
        ...actual,
        formatISODate: (date: Date) => date.toISOString().split('T')[0],
        parseRoundTime: (t: number) => new Date(t * 1000),
    }
})

const SWAP_DETAIL = {
    assetInId: '0',
    assetInUnitName: 'ALGO',
    assetInDecimals: 6,
    assetOutId: '31566704',
    assetOutUnitName: 'USDC',
    assetOutDecimals: 6,
    amountIn: new Decimal(1_000_000),
    amountOut: new Decimal(500_000),
}

describe('useAccountHistory', () => {
    const ACCOUNT_ADDRESS =
        'VALID_ADDRESS_58_CHARS_LONG_AAAAAAAAAAAAAAAAAAAAAAAAAAAA'
    const mockAccount = {
        chains: { algorand: { address: ACCOUNT_ADDRESS } },
    }
    const mockShowToast = vi.fn()
    const mockShowError = vi.fn()
    const mockExportCsv = vi.fn()
    const mockFetchNextPage = vi.fn()
    const mockRefreshAccounts = vi.fn()
    const mockInvalidateQueries = vi.fn()

    beforeEach(() => {
        vi.clearAllMocks()
        historyChainAdapters.reset()
        historyChainAdapters.register(algorandHistoryAdapter)
        vi.mocked(useChainCapability).mockReset()
        vi.mocked(useIsCapabilityRestricted).mockReset()
        mockNavigate.mockReset()
        mockUseNetworkStatus.mockReturnValue({ hasInternet: true })
        mockRefreshAccounts.mockResolvedValue(undefined)
        vi.mocked(getSyncService).mockReturnValue({
            refreshAccounts: mockRefreshAccounts,
            invalidateQueries: mockInvalidateQueries,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        vi.mocked(useSelectedAccount).mockReturnValue(mockAccount as any)
        mockScopeNetwork.current = 'mainnet'
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        vi.mocked(useToast).mockReturnValue({ showToast: mockShowToast } as any)
        vi.mocked(useErrorToast).mockReturnValue({
            showError: mockShowError,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any)

        vi.mocked(useTransactionHistoryQuery).mockReturnValue({
            transactions: [],
            isLoading: false,
            isFetchingNextPage: false,
            isError: false,
            error: null,
            hasNextPage: false,
            fetchNextPage: mockFetchNextPage,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any)

        vi.mocked(useTransactionRecordsQuery).mockReturnValue({
            records: [],
            isLoading: false,
            isFetched: false,
            isFetching: false,
            isFetchingNextPage: false,
            isError: false,
            error: null,
            hasNextPage: false,
            isSearchPaused: false,
            fetchNextPage: mockFetchNextPage,
            refetch: vi.fn(),
        })

        vi.mocked(useCsvExportMutation).mockReturnValue({
            exportCsv: mockExportCsv,
            isLoading: false,
            isError: false,
            error: null,
            isSuccess: false,
            result: null,
            reset: vi.fn(),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any)
    })

    // Grouping semantics live in the transactionListRows spec; these only
    // check that the hook feeds the query's transactions through it.
    describe('list rows', () => {
        it('interleaves date headers with transaction rows', () => {
            const transactions = [
                { id: '1', roundTime: 1_704_067_200, sender: 'A' }, // 2024-01-01
                { id: '2', roundTime: 1_704_153_600, sender: 'B' }, // 2024-01-02
            ]
            vi.mocked(useTransactionHistoryQuery).mockReturnValue({
                transactions,
                isLoading: false,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any)

            const { result } = renderHook(() => useAccountHistory())

            expect(result.current.rows.map(row => row.key)).toEqual([
                '2024-01-02',
                '2',
                '2024-01-01',
                '1',
            ])
        })

        it('returns no rows when no transactions', () => {
            vi.mocked(useTransactionHistoryQuery).mockReturnValue({
                transactions: [],
                isLoading: false,
                isFetched: true,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any)

            const { result } = renderHook(() => useAccountHistory())

            expect(result.current.rows).toHaveLength(0)
            expect(result.current.isEmpty).toBe(true)
        })

        it('reports an empty online history as a genuine empty history', () => {
            mockUseNetworkStatus.mockReturnValue({ hasInternet: true })
            vi.mocked(useTransactionHistoryQuery).mockReturnValue({
                transactions: [],
                isLoading: false,
                isFetched: true,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any)

            const { result } = renderHook(() => useAccountHistory())

            expect(result.current.isEmpty).toBe(true)
            expect(result.current.isOfflineEmpty).toBe(false)
        })

        it('distinguishes an empty offline history from a genuine empty one', () => {
            mockUseNetworkStatus.mockReturnValue({ hasInternet: false })
            vi.mocked(useTransactionHistoryQuery).mockReturnValue({
                transactions: [],
                isLoading: false,
                isFetched: true,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any)

            const { result } = renderHook(() => useAccountHistory())

            expect(result.current.isEmpty).toBe(true)
            expect(result.current.isOfflineEmpty).toBe(true)
        })

        it('does not claim an offline empty state when cached rows exist', () => {
            mockUseNetworkStatus.mockReturnValue({ hasInternet: false })
            vi.mocked(useTransactionHistoryQuery).mockReturnValue({
                transactions: [{ id: '1', roundTime: 1_704_067_200 }],
                isLoading: false,
                isFetched: true,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any)

            const { result } = renderHook(() => useAccountHistory())

            expect(result.current.isOfflineEmpty).toBe(false)
        })
    })

    describe('loading states', () => {
        it('returns isLoading from query', () => {
            vi.mocked(useTransactionHistoryQuery).mockReturnValue({
                transactions: [],
                isLoading: true,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any)

            const { result } = renderHook(() => useAccountHistory())

            expect(result.current.isLoading).toBe(true)
        })

        it('returns isFetchingNextPage from query', () => {
            vi.mocked(useTransactionHistoryQuery).mockReturnValue({
                transactions: [],
                isLoading: false,
                isFetchingNextPage: true,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any)

            const { result } = renderHook(() => useAccountHistory())

            expect(result.current.isFetchingNextPage).toBe(true)
        })

        // A disabled query (no account address resolved yet) reports
        // isLoading: false with no data, which used to read as "empty".
        it('reports initial load, not empty, before the first read resolves', () => {
            vi.mocked(useTransactionHistoryQuery).mockReturnValue({
                transactions: [],
                isLoading: false,
                isFetched: false,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any)

            const { result } = renderHook(() => useAccountHistory())

            expect(result.current.isInitialLoad).toBe(true)
            expect(result.current.isEmpty).toBe(false)
        })

        it('reports initial load while the first read is in flight', () => {
            vi.mocked(useTransactionHistoryQuery).mockReturnValue({
                transactions: [],
                isLoading: true,
                isFetched: false,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any)

            const { result } = renderHook(() => useAccountHistory())

            expect(result.current.isInitialLoad).toBe(true)
            expect(result.current.isEmpty).toBe(false)
        })

        it('shows a retry state, not an endless skeleton, when the read fails', () => {
            vi.mocked(useTransactionHistoryQuery).mockReturnValue({
                transactions: [],
                isLoading: false,
                isFetched: true,
                isError: true,
                error: new Error('history unavailable'),
                // A failed next page leaves the query thinking there is more.
                hasNextPage: true,
                fetchNextPage: mockFetchNextPage,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any)

            const { result } = renderHook(() => useAccountHistory())

            expect(result.current.isLoadFailed).toBe(true)
            expect(result.current.isInitialLoad).toBe(false)
            expect(result.current.isEmpty).toBe(false)

            act(() => result.current.handleRetry())

            expect(mockFetchNextPage).toHaveBeenCalledTimes(1)
        })

        it('re-reads from the start when the first page itself failed', () => {
            const refetch = vi.fn()
            vi.mocked(useTransactionHistoryQuery).mockReturnValue({
                transactions: [],
                isFetched: true,
                isError: true,
                hasNextPage: false,
                refetch,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any)

            const { result } = renderHook(() => useAccountHistory())
            act(() => result.current.handleRetry())

            expect(refetch).toHaveBeenCalledTimes(1)
            expect(mockFetchNextPage).not.toHaveBeenCalled()
        })

        it('tells a Pera service this network lacks apart from a failure a retry can fix', () => {
            vi.mocked(useTransactionHistoryQuery).mockReturnValue({
                transactions: [],
                isFetched: true,
                isError: true,
                error: new PeraServiceUnavailableError({
                    chainId: 'algorand',
                    networkId: 'mainnet',
                }),
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any)

            const { result } = renderHook(() => useAccountHistory())

            expect(result.current.isLoadFailed).toBe(true)
            expect(result.current.isLoadUnavailable).toBe(true)
            expect(result.current.isLoadIntegrityBlocked).toBe(false)
        })

        it('reports a refused integrity token as its own load state', () => {
            vi.mocked(useTransactionHistoryQuery).mockReturnValue({
                transactions: [],
                isFetched: true,
                isError: true,
                error: new IntegrityRequiredError({
                    code: null,
                    status: 401,
                    hadToken: false,
                }),
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any)

            const { result } = renderHook(() => useAccountHistory())

            expect(result.current.isLoadIntegrityBlocked).toBe(true)
            expect(result.current.isLoadUnavailable).toBe(false)
        })

        it('marks a read that failed offline so it gets the offline copy', () => {
            mockUseNetworkStatus.mockReturnValue({ hasInternet: false })
            vi.mocked(useTransactionHistoryQuery).mockReturnValue({
                transactions: [],
                isFetched: true,
                isError: true,
                error: new Error('network down'),
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any)

            const { result } = renderHook(() => useAccountHistory())

            expect(result.current.isLoadFailed).toBe(true)
            expect(result.current.isLoadOffline).toBe(true)
        })

        it('reports a retry in flight while the failure is still set', () => {
            vi.mocked(useTransactionHistoryQuery).mockReturnValue({
                transactions: [],
                isFetched: true,
                isFetching: true,
                isError: true,
                error: new Error('history unavailable'),
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any)

            const { result } = renderHook(() => useAccountHistory())

            expect(result.current.isRetrying).toBe(true)
        })

        it('keeps rendering cached rows instead of the skeleton on refetch', () => {
            vi.mocked(useTransactionHistoryQuery).mockReturnValue({
                transactions: [{ id: '1', roundTime: 1_704_067_200 }],
                isLoading: true,
                isFetched: true,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any)

            const { result } = renderHook(() => useAccountHistory())

            expect(result.current.isInitialLoad).toBe(false)
            expect(result.current.isEmpty).toBe(false)
        })
    })

    describe('filter handling', () => {
        it('passes filter parameters to useTransactionHistoryQuery', async () => {
            mockRequestBottomSheet.mockResolvedValueOnce({
                filter: TransactionFilter.Today,
            })
            const { result } = renderHook(() => useAccountHistory())

            await act(async () => {
                await result.current.handleOpenFilter()
            })

            expect(useTransactionHistoryQuery).toHaveBeenCalledWith(
                expect.objectContaining({
                    afterTime: expect.any(String),
                }),
            )
        })

        it('updates activeFilter when filter sheet resolves', async () => {
            mockRequestBottomSheet.mockResolvedValueOnce({
                filter: TransactionFilter.Yesterday,
            })
            const { result } = renderHook(() => useAccountHistory())

            expect(result.current.activeFilter).toBe(TransactionFilter.AllTime)

            await act(async () => {
                await result.current.handleOpenFilter()
            })

            expect(result.current.activeFilter).toBe(
                TransactionFilter.Yesterday,
            )
            expect(mockTrackEvent).toHaveBeenCalledWith(
                AccountDetailsEvent.TransactionFilter,
                { [AnalyticsMetadataKey.ChainId]: 'algorand' },
            )
        })

        it('handles custom range filter', async () => {
            const customRange = {
                from: new Date('2024-01-01'),
                to: new Date('2024-01-15'),
            }
            mockRequestBottomSheet.mockResolvedValueOnce({
                filter: TransactionFilter.CustomRange,
                customRange,
            })
            const { result } = renderHook(() => useAccountHistory())

            await act(async () => {
                await result.current.handleOpenFilter()
            })

            expect(result.current.activeFilter).toBe(
                TransactionFilter.CustomRange,
            )
            expect(result.current.customRange).toEqual(customRange)
        })
    })

    it("lists an Ethereum account's history from its records, never the row cache", () => {
        registerEthereumChain()
        const address = `0x${'c'.repeat(40)}`
        vi.mocked(useSelectedAccount).mockReturnValue({
            id: 'eth',
            custody: { kind: 'watch' },
            chains: { ethereum: { address } },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any)
        const record: TransactionRecord = {
            id: '0xhash',
            scope: { chainId: 'ethereum', networkId: 'mainnet' },
            status: 'confirmed',
            timestamp: 1_704_067_200_000,
            summary: {
                kind: 'transfer',
                title: { key: i18nKey('transactions.list_item.receive') },
                direction: 'in',
                icon: 'receive',
            },
            chainData: { family: 'evm' },
        }
        vi.mocked(useTransactionRecordsQuery).mockReturnValue({
            records: [record],
            isLoading: false,
            isFetched: true,
            isFetching: false,
            isFetchingNextPage: false,
            isError: false,
            error: null,
            hasNextPage: false,
            isSearchPaused: false,
            fetchNextPage: mockFetchNextPage,
            refetch: vi.fn(),
        })

        const { result } = renderHook(() => useAccountHistory())

        expect(useTransactionHistoryQuery).toHaveBeenCalledWith(
            expect.objectContaining({ isEnabled: false }),
        )
        expect(useTransactionRecordsQuery).toHaveBeenCalledWith(
            expect.objectContaining({
                accountAddress: address,
                isEnabled: true,
            }),
        )
        expect(result.current.rows).toEqual([
            expect.objectContaining({ kind: 'header', key: '2024-01-01' }),
            { kind: 'record', key: '0xhash', record },
        ])
        expect(result.current.isEmpty).toBe(false)
        expect(result.current.isInitialLoad).toBe(false)
    })

    it('offers to search older history, not a skeleton, once the records search pauses', () => {
        registerEthereumChain()
        vi.mocked(useSelectedAccount).mockReturnValue({
            id: 'eth',
            custody: { kind: 'watch' },
            chains: { ethereum: { address: `0x${'c'.repeat(40)}` } },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any)
        vi.mocked(useTransactionRecordsQuery).mockReturnValue({
            records: [],
            isLoading: false,
            isFetched: true,
            isFetching: false,
            isFetchingNextPage: false,
            isError: false,
            error: null,
            hasNextPage: true,
            isSearchPaused: true,
            fetchNextPage: mockFetchNextPage,
            refetch: vi.fn(),
        })

        const { result } = renderHook(() => useAccountHistory())

        expect(result.current.isSearchPaused).toBe(true)
        expect(result.current.isInitialLoad).toBe(false)
        expect(result.current.isEmpty).toBe(false)

        act(() => result.current.handleLoadMore())
        expect(mockFetchNextPage).not.toHaveBeenCalled()

        act(() => result.current.handleSearchOlder())

        expect(mockFetchNextPage).toHaveBeenCalledTimes(1)
    })

    it("tracks filtering and downloading on an Ethereum account's chain", async () => {
        registerEthereumChain()
        vi.mocked(useSelectedAccount).mockReturnValue({
            id: 'eth',
            custody: { kind: 'watch' },
            chains: { ethereum: { address: `0x${'c'.repeat(40)}` } },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any)
        mockRequestBottomSheet.mockResolvedValueOnce({
            filter: TransactionFilter.Today,
        })
        const { result } = renderHook(() => useAccountHistory())

        await act(async () => {
            await result.current.handleOpenFilter()
        })
        act(() => {
            result.current.handleExportCsv()
        })

        expect(mockTrackEvent).toHaveBeenCalledWith(
            AccountDetailsEvent.TransactionFilter,
            { [AnalyticsMetadataKey.ChainId]: 'ethereum' },
        )
        expect(mockTrackEvent).toHaveBeenCalledWith(
            AccountDetailsEvent.TransactionDownload,
            { [AnalyticsMetadataKey.ChainId]: 'ethereum' },
        )
    })

    describe('pagination', () => {
        it('calls fetchNextPage when handleLoadMore is called and hasNextPage', () => {
            vi.mocked(useTransactionHistoryQuery).mockReturnValue({
                transactions: [],
                isLoading: false,
                isFetchingNextPage: false,
                hasNextPage: true,
                fetchNextPage: mockFetchNextPage,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any)

            const { result } = renderHook(() => useAccountHistory())

            result.current.handleLoadMore()

            expect(mockFetchNextPage).toHaveBeenCalled()
        })

        it('does not call fetchNextPage when already fetching', () => {
            vi.mocked(useTransactionHistoryQuery).mockReturnValue({
                transactions: [],
                isLoading: false,
                isFetchingNextPage: true,
                hasNextPage: true,
                fetchNextPage: mockFetchNextPage,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any)

            const { result } = renderHook(() => useAccountHistory())

            result.current.handleLoadMore()

            expect(mockFetchNextPage).not.toHaveBeenCalled()
        })

        it('does not call fetchNextPage when no more pages', () => {
            vi.mocked(useTransactionHistoryQuery).mockReturnValue({
                transactions: [],
                isLoading: false,
                isFetchingNextPage: false,
                hasNextPage: false,
                fetchNextPage: mockFetchNextPage,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any)

            const { result } = renderHook(() => useAccountHistory())

            result.current.handleLoadMore()

            expect(mockFetchNextPage).not.toHaveBeenCalled()
        })
    })

    describe('refresh', () => {
        it('refreshes the selected account through the sync service', async () => {
            const { result } = renderHook(() => useAccountHistory())

            await act(async () => {
                result.current.handleRefresh()
            })

            expect(mockRefreshAccounts).toHaveBeenCalledWith(
                [ACCOUNT_ADDRESS],
                { chainId: 'algorand', networkId: 'mainnet' },
            )
        })

        it('refreshes an Ethereum account on its own chain, so its records History is invalidated', async () => {
            registerEthereumChain()
            const address = `0x${'c'.repeat(40)}`
            vi.mocked(useSelectedAccount).mockReturnValue({
                id: 'eth',
                custody: { kind: 'watch' },
                chains: { ethereum: { address } },
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any)

            const { result } = renderHook(() => useAccountHistory())
            await act(async () => {
                result.current.handleRefresh()
            })

            expect(mockRefreshAccounts).toHaveBeenCalledWith([address], {
                chainId: 'ethereum',
                networkId: 'mainnet',
            })
        })

        it('reports isRefreshing while the sync refresh is in flight', async () => {
            let releaseRefresh: () => void = () => {}
            mockRefreshAccounts.mockReturnValue(
                new Promise<void>(resolve => {
                    releaseRefresh = resolve
                }),
            )

            const { result } = renderHook(() => useAccountHistory())
            expect(result.current.isRefreshing).toBe(false)

            act(() => {
                result.current.handleRefresh()
            })
            expect(result.current.isRefreshing).toBe(true)

            await act(async () => {
                releaseRefresh()
            })
            expect(result.current.isRefreshing).toBe(false)
        })
    })

    describe('CSV Export', () => {
        it('calls exportCsv when handleExportCsv is called', () => {
            const { result } = renderHook(() => useAccountHistory())

            result.current.handleExportCsv()

            expect(mockExportCsv).toHaveBeenCalledWith({
                accountAddress: ACCOUNT_ADDRESS,
            })
            expect(mockTrackEvent).toHaveBeenCalledWith(
                AccountDetailsEvent.TransactionDownload,
                { [AnalyticsMetadataKey.ChainId]: 'algorand' },
            )
        })

        it('does not call exportCsv if no account is selected', () => {
            vi.mocked(useSelectedAccount).mockReturnValue(null)
            const { result } = renderHook(() => useAccountHistory())

            result.current.handleExportCsv()

            expect(mockExportCsv).not.toHaveBeenCalled()
        })

        it('returns isExportingCsv from mutation', () => {
            vi.mocked(useCsvExportMutation).mockReturnValue({
                exportCsv: mockExportCsv,
                isLoading: true,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any)

            const { result } = renderHook(() => useAccountHistory())

            expect(result.current.isExportingCsv).toBe(true)
        })

        it('shares CSV as a file upon successful export', async () => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            let successCallback: (result: any) => Promise<void> = async () => {}
            vi.mocked(useCsvExportMutation).mockImplementation(
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                ({ onSuccess }: any) => {
                    successCallback = onSuccess
                    return {
                        exportCsv: mockExportCsv,
                        isLoading: false,
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    } as any
                },
            )

            renderHook(() => useAccountHistory())

            const mockResult = {
                filename: 'test.csv',
                csvContent: 'data',
                accountAddress: 'addr',
                rowCount: 1,
            }

            await successCallback(mockResult)

            expect(shareFile).toHaveBeenCalledWith('test.csv', 'data', {
                mimeType: 'text/csv',
            })
        })

        it('delegates to useErrorToast rather than rendering the raw error when share fails', async () => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            let successCallback: (result: any) => Promise<void> = async () => {}
            vi.mocked(useCsvExportMutation).mockImplementation(
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                ({ onSuccess }: any) => {
                    successCallback = onSuccess
                    return {
                        exportCsv: mockExportCsv,
                        isLoading: false,
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    } as any
                },
            )

            const shareError = new Error('Share cancelled')
            vi.mocked(shareFile).mockRejectedValueOnce(shareError)

            renderHook(() => useAccountHistory())

            await successCallback({ filename: 'f', csvContent: 'c' })

            expect(mockShowError).toHaveBeenCalledWith(
                shareError,
                'errors.general.title',
            )
            // The raw error must never be handed directly to showToast.
            expect(mockShowToast).not.toHaveBeenCalled()
        })

        it('delegates to useErrorToast rather than rendering the raw error when export fails', () => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            let errorCallback: (error: any) => void = () => {}
            vi.mocked(useCsvExportMutation).mockImplementation(
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                ({ onError }: any) => {
                    errorCallback = onError
                    return {
                        exportCsv: mockExportCsv,
                        isLoading: false,
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    } as any
                },
            )

            renderHook(() => useAccountHistory())

            const exportError = new AppError('raw internal detail', {})
            errorCallback(exportError)

            expect(mockShowError).toHaveBeenCalledWith(
                exportError,
                'errors.general.title',
            )
            // The raw error must never be handed directly to showToast.
            expect(mockShowToast).not.toHaveBeenCalled()
        })
    })

    const mockUnavailableNetwork = (network: string) => {
        mockScopeNetwork.current = network
        vi.mocked(useTransactionHistoryQuery).mockReturnValue({
            transactions: [{ id: '1', roundTime: 1_704_067_200 }],
            isLoading: false,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any)
        vi.mocked(useCsvExportMutation).mockReturnValue({
            exportCsv: mockExportCsv,
            isLoading: false,
            isUnavailableOnNetwork: true,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any)
        vi.mocked(useChainCapability).mockReturnValue(false)
        vi.mocked(useIsCapabilityRestricted).mockReturnValue(true)
    }

    describe('CSV export visibility', () => {
        it('shows the export action when transactions exist', () => {
            vi.mocked(useTransactionHistoryQuery).mockReturnValue({
                transactions: [{ id: '1', roundTime: 1_704_067_200 }],
                isLoading: false,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any)

            const { result } = renderHook(() => useAccountHistory())

            expect(result.current.isCsvExportVisible).toBe(true)
        })

        it('hides the export action on an Ethereum account, whose chain has no CSV export', () => {
            registerEthereumChain()
            vi.mocked(useSelectedAccount).mockReturnValue({
                id: 'eth',
                custody: { kind: 'watch' },
                chains: { ethereum: { address: `0x${'c'.repeat(40)}` } },
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any)
            vi.mocked(useTransactionHistoryQuery).mockReturnValue({
                transactions: [{ id: '1', roundTime: 1_704_067_200 }],
                isLoading: false,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any)

            const { result } = renderHook(() => useAccountHistory())

            expect(result.current.isCsvExportVisible).toBe(false)
        })

        it.each(['betanet', 'custom'])(
            'keeps the export action visible on %s',
            network => {
                mockUnavailableNetwork(network)

                const { result } = renderHook(() => useAccountHistory())

                expect(result.current.isCsvExportVisible).toBe(true)
            },
        )

        it.each(['betanet', 'custom'])(
            'explains why instead of exporting on %s',
            network => {
                mockUnavailableNetwork(network)

                const { result } = renderHook(() => useAccountHistory())
                result.current.handleExportCsv()

                expect(mockExportCsv).not.toHaveBeenCalled()
                expect(mockShowError).toHaveBeenCalledTimes(1)
                const [error, title] = mockShowError.mock.calls[0]
                expect(isPeraServiceUnavailableError(error)).toBe(true)
                expect(
                    (error as PeraServiceUnavailableError).scope,
                ).toStrictEqual({ chainId: 'algorand', networkId: network })
                expect(title).toBe('common.network_unavailable.title')
            },
        )
    })

    describe('transaction press', () => {
        const press = (chainData: unknown) => {
            const { result } = renderHook(() => useAccountHistory())
            const transaction = {
                id: 'TX_PRESS',
                txType: 'appl',
                sender: 'sender-address',
                assetSender: null,
                receiver: null,
                confirmedRound: 300,
                roundTime: 1_704_240_000,
                interpretedMeaning: null,
                fee: new Decimal(2000),
                amount: null,
                asset: null,
                balanceImpacts: [],
                chainData,
            } satisfies TransactionHistoryItem

            result.current.handleTransactionPress(transaction)

            return transaction
        }

        it('navigates to GroupTransactionList for an Algorand swap row in a group', () => {
            press({
                ...EMPTY_ALGORAND_HISTORY_DATA,
                groupId: 'SWAP_GROUP_ABC',
                swapGroupDetail: SWAP_DETAIL,
            })

            expect(mockNavigate).toHaveBeenCalledWith('GroupTransactionList', {
                groupId: 'SWAP_GROUP_ABC',
            })
        })

        it('navigates to TransactionDetails for a grouped row that is not a swap', () => {
            const transaction = press({
                ...EMPTY_ALGORAND_HISTORY_DATA,
                groupId: 'GROUP_XYZ',
            })

            expect(mockNavigate).toHaveBeenCalledWith('TransactionDetails', {
                scope: expect.objectContaining({ chainId: 'algorand' }),
                transactionId: transaction.id,
                historyTransaction: transaction,
            })
        })

        it('navigates to TransactionDetails for a swap row without a group', () => {
            const transaction = press({
                ...EMPTY_ALGORAND_HISTORY_DATA,
                swapGroupDetail: SWAP_DETAIL,
            })

            expect(mockNavigate).toHaveBeenCalledWith('TransactionDetails', {
                scope: expect.objectContaining({ chainId: 'algorand' }),
                transactionId: transaction.id,
                historyTransaction: transaction,
            })
        })

        it('navigates to TransactionDetails for a row with no chain data', () => {
            const transaction = press(null)

            expect(mockNavigate).toHaveBeenCalledWith('TransactionDetails', {
                scope: expect.objectContaining({ chainId: 'algorand' }),
                transactionId: transaction.id,
                historyTransaction: transaction,
            })
        })
    })
})

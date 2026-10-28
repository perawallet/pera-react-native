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
import { useAssetTransactionList } from '../useAssetTransactionList'
import { getSyncService } from '@perawallet/wallet-core-background'
import {
    historyChainAdapters,
    useCsvExportMutation,
    useTransactionHistoryQuery,
    useTransactionRecordsQuery,
    type TransactionHistoryItem,
} from '@perawallet/wallet-core-transactions'
import {
    algorandHistoryAdapter,
    EMPTY_ALGORAND_HISTORY_DATA,
} from '@perawallet/wallet-core-chain-algorand/transactions'
import { Decimal } from 'decimal.js'
import { shareFile } from '@utils/shareFile'
import { useToast } from '@hooks/useToast'
import { TransactionFilter } from '@modules/accounts'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import type { PeraAsset } from '@perawallet/wallet-core-assets'
import { useErrorToast } from '@hooks/useErrorToast'
import {
    isPeraServiceUnavailableError,
    PeraServiceUnavailableError,
} from '@perawallet/wallet-core-shared'
import {
    LEGACY_CHAIN_ID,
    i18nKey,
    type TransactionRecord,
} from '@perawallet/wallet-core-chain-contract'
import { registerEthereumChain } from '@test-utils/chain-fixtures'

const mockRequestBottomSheet = vi.fn()
const mockUseNetworkStatus = vi.hoisted(() => vi.fn())
vi.mock('@modules/network', () => ({
    useNetworkStatus: mockUseNetworkStatus,
}))

vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheet: () => ({ request: mockRequestBottomSheet }),
}))

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

const MAINNET_SCOPE = {
    chainId: LEGACY_CHAIN_ID,
    networkId: 'mainnet',
} as const

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

describe('useAssetTransactionList', () => {
    const ACCOUNT_ADDRESS =
        'VALID_ADDRESS_58_CHARS_LONG_AAAAAAAAAAAAAAAAAAAAAAAAAAAA'
    const mockAccount = {
        id: 'test-account',
        name: 'Test Account',
        custody: { kind: 'local', seed: null },
        chains: { algorand: { address: ACCOUNT_ADDRESS } },
    } as WalletAccount

    const mockAsset: PeraAsset = {
        assetId: '12345',
        name: 'Test Asset',
        unitName: 'TST',
        decimals: 6,
        creator: { address: 'CREATOR_ADDRESS' },
    } as PeraAsset

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
        mockNavigate.mockReset()
        mockUseNetworkStatus.mockReturnValue({ hasInternet: true })
        mockRefreshAccounts.mockResolvedValue(undefined)
        vi.mocked(getSyncService).mockReturnValue({
            refreshAccounts: mockRefreshAccounts,
            invalidateQueries: mockInvalidateQueries,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any)
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

    describe('initialization', () => {
        it('queries transactions with correct assetId as string', () => {
            renderHook(() =>
                useAssetTransactionList({
                    scope: MAINNET_SCOPE,
                    account: mockAccount,
                    asset: mockAsset,
                }),
            )

            expect(useTransactionHistoryQuery).toHaveBeenCalledWith({
                accountAddress: ACCOUNT_ADDRESS,
                assetId: '12345',
                scope: { chainId: 'algorand', networkId: 'mainnet' },
                isEnabled: true,
                afterTime: undefined,
                beforeTime: undefined,
            })
        })

        it('reads the history on the scope it is given', () => {
            const testnet = {
                chainId: LEGACY_CHAIN_ID,
                networkId: 'testnet',
            } as const

            renderHook(() =>
                useAssetTransactionList({
                    scope: testnet,
                    account: mockAccount,
                    asset: mockAsset,
                }),
            )

            expect(useTransactionHistoryQuery).toHaveBeenCalledWith(
                expect.objectContaining({ scope: testnet }),
            )
        })

        it('passes assetId as string to query', () => {
            const assetWithStringId = {
                ...mockAsset,
                assetId: '67890',
            }

            renderHook(() =>
                useAssetTransactionList({
                    scope: MAINNET_SCOPE,
                    account: mockAccount,
                    asset: assetWithStringId,
                }),
            )

            expect(useTransactionHistoryQuery).toHaveBeenCalledWith(
                expect.objectContaining({
                    assetId: '67890',
                }),
            )
        })

        it('handles ALGO asset (assetId "0")', () => {
            const algoAsset = {
                ...mockAsset,
                assetId: '0',
            }

            renderHook(() =>
                useAssetTransactionList({
                    scope: MAINNET_SCOPE,
                    account: mockAccount,
                    asset: algoAsset,
                }),
            )

            expect(useTransactionHistoryQuery).toHaveBeenCalledWith(
                expect.objectContaining({
                    assetId: '0',
                }),
            )
        })
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

            const { result } = renderHook(() =>
                useAssetTransactionList({
                    scope: MAINNET_SCOPE,
                    account: mockAccount,
                    asset: mockAsset,
                }),
            )

            expect(result.current.rows.map(row => row.key)).toEqual([
                '2024-01-02',
                '2',
                '2024-01-01',
                '1',
            ])
        })

        it('returns no rows when no transactions', () => {
            const { result } = renderHook(() =>
                useAssetTransactionList({
                    scope: MAINNET_SCOPE,
                    account: mockAccount,
                    asset: mockAsset,
                }),
            )

            expect(result.current.rows).toHaveLength(0)
        })

        it('reports initial load, not empty, before the first read resolves', () => {
            vi.mocked(useTransactionHistoryQuery).mockReturnValue({
                transactions: [],
                isLoading: false,
                isFetched: false,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any)

            const { result } = renderHook(() =>
                useAssetTransactionList({
                    scope: MAINNET_SCOPE,
                    account: mockAccount,
                    asset: mockAsset,
                }),
            )

            expect(result.current.isInitialLoad).toBe(true)
            expect(result.current.isEmpty).toBe(false)
        })

        it('distinguishes an empty offline history from a genuine empty one', () => {
            mockUseNetworkStatus.mockReturnValue({ hasInternet: false })
            vi.mocked(useTransactionHistoryQuery).mockReturnValue({
                transactions: [],
                isLoading: false,
                isFetched: true,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any)

            const { result } = renderHook(() =>
                useAssetTransactionList({
                    scope: MAINNET_SCOPE,
                    account: mockAccount,
                    asset: mockAsset,
                }),
            )

            expect(result.current.isEmpty).toBe(true)
            expect(result.current.isOfflineEmpty).toBe(true)
        })

        it('reports an empty online history as a genuine empty history', () => {
            mockUseNetworkStatus.mockReturnValue({ hasInternet: true })
            vi.mocked(useTransactionHistoryQuery).mockReturnValue({
                transactions: [],
                isLoading: false,
                isFetched: true,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any)

            const { result } = renderHook(() =>
                useAssetTransactionList({
                    scope: MAINNET_SCOPE,
                    account: mockAccount,
                    asset: mockAsset,
                }),
            )

            expect(result.current.isEmpty).toBe(true)
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

            const { result } = renderHook(() =>
                useAssetTransactionList({
                    scope: MAINNET_SCOPE,
                    account: mockAccount,
                    asset: mockAsset,
                }),
            )

            expect(result.current.isLoading).toBe(true)
        })

        it('returns isFetchingNextPage from query', () => {
            vi.mocked(useTransactionHistoryQuery).mockReturnValue({
                transactions: [],
                isLoading: false,
                isFetchingNextPage: true,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any)

            const { result } = renderHook(() =>
                useAssetTransactionList({
                    scope: MAINNET_SCOPE,
                    account: mockAccount,
                    asset: mockAsset,
                }),
            )

            expect(result.current.isFetchingNextPage).toBe(true)
        })
    })

    describe('filter handling', () => {
        it('passes filter parameters to useTransactionHistoryQuery', async () => {
            mockRequestBottomSheet.mockResolvedValueOnce({
                filter: TransactionFilter.Today,
            })
            const { result } = renderHook(() =>
                useAssetTransactionList({
                    scope: MAINNET_SCOPE,
                    account: mockAccount,
                    asset: mockAsset,
                }),
            )

            await act(async () => {
                await result.current.handleOpenFilter()
            })

            expect(useTransactionHistoryQuery).toHaveBeenCalledWith(
                expect.objectContaining({
                    afterTime: expect.any(String),
                    assetId: '12345',
                }),
            )
        })

        it('updates activeFilter when filter sheet resolves', async () => {
            mockRequestBottomSheet.mockResolvedValueOnce({
                filter: TransactionFilter.Yesterday,
            })
            const { result } = renderHook(() =>
                useAssetTransactionList({
                    scope: MAINNET_SCOPE,
                    account: mockAccount,
                    asset: mockAsset,
                }),
            )

            expect(result.current.activeFilter).toBe(TransactionFilter.AllTime)

            await act(async () => {
                await result.current.handleOpenFilter()
            })

            expect(result.current.activeFilter).toBe(
                TransactionFilter.Yesterday,
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
            const { result } = renderHook(() =>
                useAssetTransactionList({
                    scope: MAINNET_SCOPE,
                    account: mockAccount,
                    asset: mockAsset,
                }),
            )

            await act(async () => {
                await result.current.handleOpenFilter()
            })

            expect(result.current.activeFilter).toBe(
                TransactionFilter.CustomRange,
            )
            expect(result.current.customRange).toEqual(customRange)
        })

        it('applies both date filter and asset filter', async () => {
            mockRequestBottomSheet.mockResolvedValueOnce({
                filter: TransactionFilter.LastWeek,
            })
            const { result } = renderHook(() =>
                useAssetTransactionList({
                    scope: MAINNET_SCOPE,
                    account: mockAccount,
                    asset: mockAsset,
                }),
            )

            await act(async () => {
                await result.current.handleOpenFilter()
            })

            expect(useTransactionHistoryQuery).toHaveBeenCalledWith(
                expect.objectContaining({
                    assetId: '12345',
                    afterTime: expect.any(String),
                    beforeTime: expect.any(String),
                }),
            )
        })
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

            const { result } = renderHook(() =>
                useAssetTransactionList({
                    scope: MAINNET_SCOPE,
                    account: mockAccount,
                    asset: mockAsset,
                }),
            )

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

            const { result } = renderHook(() =>
                useAssetTransactionList({
                    scope: MAINNET_SCOPE,
                    account: mockAccount,
                    asset: mockAsset,
                }),
            )

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

            const { result } = renderHook(() =>
                useAssetTransactionList({
                    scope: MAINNET_SCOPE,
                    account: mockAccount,
                    asset: mockAsset,
                }),
            )

            result.current.handleLoadMore()

            expect(mockFetchNextPage).not.toHaveBeenCalled()
        })
    })

    describe('refresh', () => {
        it('refreshes the holding account through the sync service', async () => {
            const { result } = renderHook(() =>
                useAssetTransactionList({
                    scope: MAINNET_SCOPE,
                    account: mockAccount,
                    asset: mockAsset,
                }),
            )

            await act(async () => {
                result.current.handleRefresh()
            })

            expect(mockRefreshAccounts).toHaveBeenCalledWith(
                [ACCOUNT_ADDRESS],
                { chainId: 'algorand', networkId: 'mainnet' },
            )
        })

        it('reports isRefreshing while the sync refresh is in flight', async () => {
            let releaseRefresh: () => void = () => {}
            mockRefreshAccounts.mockReturnValue(
                new Promise<void>(resolve => {
                    releaseRefresh = resolve
                }),
            )

            const { result } = renderHook(() =>
                useAssetTransactionList({
                    scope: MAINNET_SCOPE,
                    account: mockAccount,
                    asset: mockAsset,
                }),
            )
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
        it('calls exportCsv with assetId when handleExportCsv is called', () => {
            const { result } = renderHook(() =>
                useAssetTransactionList({
                    scope: MAINNET_SCOPE,
                    account: mockAccount,
                    asset: mockAsset,
                }),
            )

            result.current.handleExportCsv()

            expect(mockExportCsv).toHaveBeenCalledWith({
                accountAddress: ACCOUNT_ADDRESS,
                assetId: '12345',
            })
        })

        it('does not call exportCsv if no account address', () => {
            const accountWithoutAddress = { ...mockAccount, chains: {} }

            const { result } = renderHook(() =>
                useAssetTransactionList({
                    scope: MAINNET_SCOPE,
                    account: accountWithoutAddress,
                    asset: mockAsset,
                }),
            )

            result.current.handleExportCsv()

            expect(mockExportCsv).not.toHaveBeenCalled()
        })

        it('exports CSV with correct assetId for different assets', () => {
            const differentAsset = {
                ...mockAsset,
                assetId: '99999',
            }

            const { result } = renderHook(() =>
                useAssetTransactionList({
                    scope: MAINNET_SCOPE,
                    account: mockAccount,
                    asset: differentAsset,
                }),
            )

            result.current.handleExportCsv()

            expect(mockExportCsv).toHaveBeenCalledWith({
                accountAddress: ACCOUNT_ADDRESS,
                assetId: '99999',
            })
        })

        it('returns isExportingCsv from mutation', () => {
            vi.mocked(useCsvExportMutation).mockReturnValue({
                exportCsv: mockExportCsv,
                isLoading: true,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any)

            const { result } = renderHook(() =>
                useAssetTransactionList({
                    scope: MAINNET_SCOPE,
                    account: mockAccount,
                    asset: mockAsset,
                }),
            )

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

            renderHook(() =>
                useAssetTransactionList({
                    scope: MAINNET_SCOPE,
                    account: mockAccount,
                    asset: mockAsset,
                }),
            )

            const mockResult = {
                filename: 'test.csv',
                csvContent: 'data',
                accountAddress: ACCOUNT_ADDRESS,
                assetId: 12_345,
                rowCount: 5,
            }

            await successCallback(mockResult)

            expect(shareFile).toHaveBeenCalledWith('test.csv', 'data', {
                mimeType: 'text/csv',
            })
        })

        it('shows error toast when share fails', async () => {
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

            vi.mocked(shareFile).mockRejectedValueOnce(
                new Error('Share cancelled'),
            )

            renderHook(() =>
                useAssetTransactionList({
                    scope: MAINNET_SCOPE,
                    account: mockAccount,
                    asset: mockAsset,
                }),
            )

            await successCallback({
                filename: 'f',
                csvContent: 'c',
                assetId: 12_345,
            })

            expect(mockShowError).toHaveBeenCalledWith(
                expect.objectContaining({
                    message: 'Share cancelled',
                }),
            )
        })

        it('shows error toast when export fails', () => {
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

            renderHook(() =>
                useAssetTransactionList({
                    scope: MAINNET_SCOPE,
                    account: mockAccount,
                    asset: mockAsset,
                }),
            )

            errorCallback(new Error('API Down'))

            expect(mockShowError).toHaveBeenCalledWith(
                expect.objectContaining({
                    message: 'API Down',
                }),
            )
        })
    })

    const mockCsvUnavailable = () => {
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
    }

    describe('CSV export visibility', () => {
        it('shows the export action when transactions exist', () => {
            vi.mocked(useTransactionHistoryQuery).mockReturnValue({
                transactions: [{ id: '1', roundTime: 1_704_067_200 }],
                isLoading: false,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any)

            const { result } = renderHook(() =>
                useAssetTransactionList({
                    scope: MAINNET_SCOPE,
                    account: mockAccount,
                    asset: mockAsset,
                }),
            )

            expect(result.current.isCsvExportVisible).toBe(true)
        })

        it.each(['betanet', 'custom'])(
            'keeps the export action visible on %s',
            network => {
                mockCsvUnavailable()

                const { result } = renderHook(() =>
                    useAssetTransactionList({
                        scope: {
                            chainId: LEGACY_CHAIN_ID,
                            networkId: network,
                        } as const,
                        account: mockAccount,
                        asset: mockAsset,
                    }),
                )

                expect(result.current.isCsvExportVisible).toBe(true)
            },
        )

        it.each(['betanet', 'custom'])(
            'explains why instead of exporting on %s',
            network => {
                mockCsvUnavailable()

                const { result } = renderHook(() =>
                    useAssetTransactionList({
                        scope: {
                            chainId: LEGACY_CHAIN_ID,
                            networkId: network,
                        } as const,
                        account: mockAccount,
                        asset: mockAsset,
                    }),
                )
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
            const { result } = renderHook(() =>
                useAssetTransactionList({
                    scope: MAINNET_SCOPE,
                    account: mockAccount,
                    asset: mockAsset,
                }),
            )
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

        it('navigates to TransactionDetails without groupId for a grouped row that is not a swap', () => {
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

        it('navigates to TransactionDetails for a row with no chain data', () => {
            const transaction = press(null)

            expect(mockNavigate).toHaveBeenCalledWith('TransactionDetails', {
                scope: expect.objectContaining({ chainId: 'algorand' }),
                transactionId: transaction.id,
                historyTransaction: transaction,
            })
        })
    })

    describe('filter visibility', () => {
        it('handleOpenFilter requests the filter bottom sheet', async () => {
            mockRequestBottomSheet.mockResolvedValueOnce(undefined)
            const { result } = renderHook(() =>
                useAssetTransactionList({
                    scope: MAINNET_SCOPE,
                    account: mockAccount,
                    asset: mockAsset,
                }),
            )

            await act(async () => {
                await result.current.handleOpenFilter()
            })

            expect(mockRequestBottomSheet).toHaveBeenCalledOnce()
        })
    })

    describe('error states', () => {
        it('returns error state from query', () => {
            const mockError = new Error('Network error')
            vi.mocked(useTransactionHistoryQuery).mockReturnValue({
                transactions: [],
                isLoading: false,
                isError: true,
                error: mockError,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any)

            const { result } = renderHook(() =>
                useAssetTransactionList({
                    scope: MAINNET_SCOPE,
                    account: mockAccount,
                    asset: mockAsset,
                }),
            )

            expect(result.current.isError).toBe(true)
            expect(result.current.error).toBe(mockError)
        })

        it('shows a retry state instead of the skeleton when nothing loaded', () => {
            vi.mocked(useTransactionHistoryQuery).mockReturnValue({
                transactions: [],
                isFetched: true,
                isError: true,
                hasNextPage: true,
                fetchNextPage: mockFetchNextPage,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any)

            const { result } = renderHook(() =>
                useAssetTransactionList({
                    scope: MAINNET_SCOPE,
                    account: mockAccount,
                    asset: mockAsset,
                }),
            )

            expect(result.current.isLoadFailed).toBe(true)
            expect(result.current.isInitialLoad).toBe(false)
            act(() => result.current.handleRetry())
            expect(mockFetchNextPage).toHaveBeenCalledTimes(1)
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

            const { result } = renderHook(() =>
                useAssetTransactionList({
                    scope: MAINNET_SCOPE,
                    account: mockAccount,
                    asset: mockAsset,
                }),
            )

            expect(result.current.isLoadFailed).toBe(true)
            expect(result.current.isLoadOffline).toBe(true)
        })

        it('tells a Pera service this network lacks apart from a failure a retry can fix', () => {
            vi.mocked(useTransactionHistoryQuery).mockReturnValue({
                transactions: [],
                isFetched: true,
                isError: true,
                error: new PeraServiceUnavailableError(MAINNET_SCOPE),
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any)

            const { result } = renderHook(() =>
                useAssetTransactionList({
                    scope: MAINNET_SCOPE,
                    account: mockAccount,
                    asset: mockAsset,
                }),
            )

            expect(result.current.isLoadUnavailable).toBe(true)
            expect(result.current.isLoadIntegrityBlocked).toBe(false)
        })
    })

    describe('on Ethereum', () => {
        const ETH_SCOPE = { chainId: 'ethereum', networkId: 'mainnet' } as const
        const ETH_ADDRESS = `0x${'c'.repeat(40)}`
        const ethAccount = {
            ...mockAccount,
            chains: { ethereum: { address: ETH_ADDRESS } },
        } as unknown as WalletAccount
        const usdc = { ...mockAsset, assetId: '0xusdc' } as PeraAsset
        const record: TransactionRecord = {
            id: '0xhash',
            scope: ETH_SCOPE,
            status: 'confirmed',
            timestamp: 1_704_067_200_000,
            summary: {
                kind: 'token-transfer',
                title: { key: i18nKey('transactions.list_item.receive') },
                direction: 'in',
                icon: 'receive',
            },
            chainData: { family: 'evm' },
        }

        beforeEach(() => {
            registerEthereumChain()
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
        })

        it("lists the asset's records, filtered by asset, never the row cache", () => {
            const { result } = renderHook(() =>
                useAssetTransactionList({
                    scope: ETH_SCOPE,
                    account: ethAccount,
                    asset: usdc,
                }),
            )

            expect(useTransactionHistoryQuery).toHaveBeenCalledWith(
                expect.objectContaining({ isEnabled: false }),
            )
            expect(useTransactionRecordsQuery).toHaveBeenCalledWith(
                expect.objectContaining({
                    accountAddress: ETH_ADDRESS,
                    scope: ETH_SCOPE,
                    assetId: '0xusdc',
                    isEnabled: true,
                }),
            )
            expect(result.current.rows).toEqual([
                expect.objectContaining({ kind: 'header' }),
                { kind: 'record', key: '0xhash', record },
            ])
        })

        it('offers no CSV export on a chain whose build has none', () => {
            const { result } = renderHook(() =>
                useAssetTransactionList({
                    scope: ETH_SCOPE,
                    account: ethAccount,
                    asset: usdc,
                }),
            )

            expect(result.current.isCsvExportVisible).toBe(false)
        })

        it('offers to search older history, not a skeleton, for a barely used token', () => {
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

            const { result } = renderHook(() =>
                useAssetTransactionList({
                    scope: ETH_SCOPE,
                    account: ethAccount,
                    asset: usdc,
                }),
            )

            expect(result.current.isSearchPaused).toBe(true)
            expect(result.current.isInitialLoad).toBe(false)
            act(() => result.current.handleLoadMore())
            expect(mockFetchNextPage).not.toHaveBeenCalled()

            act(() => result.current.handleSearchOlder())
            expect(mockFetchNextPage).toHaveBeenCalledTimes(1)
        })
    })
})

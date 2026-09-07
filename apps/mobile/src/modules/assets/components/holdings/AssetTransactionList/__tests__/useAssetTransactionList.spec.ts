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
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import {
    useCsvExportMutation,
    useTransactionHistoryQuery,
} from '@perawallet/wallet-core-transactions'
import { shareCsvFile } from '@utils/shareCsvFile'
import { useToast } from '@hooks/useToast'
import { TransactionFilter } from '../../../../../accounts/components/TransactionsFilterContent/types'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import type { PeraAsset } from '@perawallet/wallet-core-assets'
import { useErrorToast } from '@hooks/useErrorToast'
import {
    isPeraServiceUnavailableError,
    type Network,
    type PeraServiceUnavailableError,
} from '@perawallet/wallet-core-shared'
import { Networks } from '@perawallet/wallet-core-config'

const mockRequestBottomSheet = vi.fn()
const mockUseNetworkStatus = vi.hoisted(() => vi.fn())
vi.mock('@modules/network', () => ({
    useNetworkStatus: mockUseNetworkStatus,
}))

vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheet: () => ({ request: mockRequestBottomSheet }),
}))

// Mock dependencies
vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetwork: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-transactions', () => ({
    useTransactionHistoryQuery: vi.fn(),
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

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: (key: string) => key }),
}))

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

vi.mock('@utils/shareCsvFile', () => ({
    shareCsvFile: vi.fn(),
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

describe('useAssetTransactionList', () => {
    const mockAccount = {
        address: 'VALID_ADDRESS_58_CHARS_LONG_AAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        name: 'Test Account',
        type: 'algo25',
    } as WalletAccount

    const mockAsset: PeraAsset = {
        assetId: '12345',
        name: 'Test Asset',
        unitName: 'TST',
        decimals: 6,
        creator: { address: 'CREATOR_ADDRESS' },
    } as PeraAsset

    const mockNetwork = { network: 'mainnet' }
    const mockShowToast = vi.fn()
    const mockShowError = vi.fn()
    const mockExportCsv = vi.fn()
    const mockFetchNextPage = vi.fn()
    const mockRefreshAccounts = vi.fn()
    const mockInvalidateQueries = vi.fn()

    beforeEach(() => {
        vi.clearAllMocks()
        mockNavigate.mockReset()
        mockUseNetworkStatus.mockReturnValue({ hasInternet: true })
        mockRefreshAccounts.mockResolvedValue(undefined)
        vi.mocked(getSyncService).mockReturnValue({
            refreshAccounts: mockRefreshAccounts,
            invalidateQueries: mockInvalidateQueries,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        vi.mocked(useNetwork).mockReturnValue(mockNetwork as any)
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
                    account: mockAccount,
                    asset: mockAsset,
                }),
            )

            expect(useTransactionHistoryQuery).toHaveBeenCalledWith({
                accountAddress: mockAccount.address,
                assetId: '12345',
                network: 'mainnet',
                isEnabled: true,
                afterTime: undefined,
                beforeTime: undefined,
            })
        })

        it('passes assetId as string to query', () => {
            const assetWithStringId = {
                ...mockAsset,
                assetId: '67890',
            }

            renderHook(() =>
                useAssetTransactionList({
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
                    account: mockAccount,
                    asset: mockAsset,
                }),
            )

            await act(async () => {
                result.current.handleRefresh()
            })

            expect(mockRefreshAccounts).toHaveBeenCalledWith(
                [mockAccount.address],
                'mainnet',
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
                    account: mockAccount,
                    asset: mockAsset,
                }),
            )

            result.current.handleExportCsv()

            expect(mockExportCsv).toHaveBeenCalledWith({
                accountAddress: mockAccount.address,
                assetId: '12345',
            })
        })

        it('does not call exportCsv if no account address', () => {
            const accountWithoutAddress = {
                ...mockAccount,
                address: '',
            }

            const { result } = renderHook(() =>
                useAssetTransactionList({
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
                    account: mockAccount,
                    asset: differentAsset,
                }),
            )

            result.current.handleExportCsv()

            expect(mockExportCsv).toHaveBeenCalledWith({
                accountAddress: mockAccount.address,
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
                    account: mockAccount,
                    asset: mockAsset,
                }),
            )

            const mockResult = {
                filename: 'test.csv',
                csvContent: 'data',
                accountAddress: mockAccount.address,
                assetId: 12_345,
                rowCount: 5,
            }

            await successCallback(mockResult)

            expect(shareCsvFile).toHaveBeenCalledWith('test.csv', 'data')
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

            vi.mocked(shareCsvFile).mockRejectedValueOnce(
                new Error('Share cancelled'),
            )

            renderHook(() =>
                useAssetTransactionList({
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

    const mockUnavailableNetwork = (network: Network) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        vi.mocked(useNetwork).mockReturnValue({ network } as any)
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
                    account: mockAccount,
                    asset: mockAsset,
                }),
            )

            expect(result.current.isCsvExportVisible).toBe(true)
        })

        it.each([Networks.betanet, Networks.custom])(
            'keeps the export action visible on %s',
            network => {
                mockUnavailableNetwork(network)

                const { result } = renderHook(() =>
                    useAssetTransactionList({
                        account: mockAccount,
                        asset: mockAsset,
                    }),
                )

                expect(result.current.isCsvExportVisible).toBe(true)
            },
        )

        it.each([Networks.betanet, Networks.custom])(
            'explains why instead of exporting on %s',
            network => {
                mockUnavailableNetwork(network)

                const { result } = renderHook(() =>
                    useAssetTransactionList({
                        account: mockAccount,
                        asset: mockAsset,
                    }),
                )
                result.current.handleExportCsv()

                expect(mockExportCsv).not.toHaveBeenCalled()
                expect(mockShowError).toHaveBeenCalledTimes(1)
                const [error, title] = mockShowError.mock.calls[0]
                expect(isPeraServiceUnavailableError(error)).toBe(true)
                expect((error as PeraServiceUnavailableError).network).toBe(
                    network,
                )
                expect(title).toBe('common.network_unavailable.title')
            },
        )
    })

    describe('transaction press', () => {
        it('navigates to TransactionDetails with transactionId when handleTransactionPress is called', () => {
            const { result } = renderHook(() =>
                useAssetTransactionList({
                    account: mockAccount,
                    asset: mockAsset,
                }),
            )

            const mockTransaction = {
                id: 'TX_ASSET_123',
                txType: 'axfer',
                sender: 'sender-address',
                receiver: 'receiver-address',
                confirmedRound: 200,
                roundTime: 1_704_067_200,
                swapGroupDetail: null,
                interpretedMeaning: null,
                fee: '1000',
                groupId: null,
                amount: '1000000',
                closeTo: null,
                asset: { assetId: '12345', name: 'Test Asset' },
                applicationId: null,
                innerTransactionCount: null,
            }

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            result.current.handleTransactionPress(mockTransaction as any)

            expect(mockNavigate).toHaveBeenCalledWith('TransactionDetails', {
                transactionId: mockTransaction.id,
                historyTransaction: mockTransaction,
            })
        })

        it('navigates to TransactionDetails without groupId for a non-swap transaction with groupId', () => {
            const { result } = renderHook(() =>
                useAssetTransactionList({
                    account: mockAccount,
                    asset: mockAsset,
                }),
            )

            const mockTransaction = {
                id: 'TX_ASSET_456',
                txType: 'axfer',
                sender: 'sender-address',
                receiver: 'receiver-address',
                confirmedRound: 250,
                roundTime: 1_704_153_600,
                swapGroupDetail: null,
                interpretedMeaning: null,
                fee: '1000',
                groupId: 'GROUP_XYZ',
                amount: '1000000',
                closeTo: null,
                asset: { assetId: '12345', name: 'Test Asset' },
                applicationId: null,
                innerTransactionCount: null,
            }

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            result.current.handleTransactionPress(mockTransaction as any)

            expect(mockNavigate).toHaveBeenCalledWith('TransactionDetails', {
                transactionId: mockTransaction.id,
                historyTransaction: mockTransaction,
            })
            expect(mockNavigate).not.toHaveBeenCalledWith(
                'TransactionDetails',
                expect.objectContaining({ groupId: expect.anything() }),
            )
        })

        it('navigates to GroupTransactionList for a swap transaction with groupId', () => {
            const { result } = renderHook(() =>
                useAssetTransactionList({
                    account: mockAccount,
                    asset: mockAsset,
                }),
            )

            const mockTransaction = {
                id: 'TX_SWAP_123',
                txType: 'appl',
                sender: 'sender-address',
                receiver: null,
                confirmedRound: 300,
                roundTime: 1_704_240_000,
                swapGroupDetail: {
                    amountIn: '1000000',
                    assetInUnitName: 'ALGO',
                    amountOut: '500000',
                    assetOutUnitName: 'USDC',
                },
                interpretedMeaning: null,
                fee: '2000',
                groupId: 'SWAP_GROUP_ABC',
                amount: null,
                closeTo: null,
                asset: null,
                applicationId: '12345',
                innerTransactionCount: 3,
            }

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            result.current.handleTransactionPress(mockTransaction as any)

            expect(mockNavigate).toHaveBeenCalledWith('GroupTransactionList', {
                groupId: 'SWAP_GROUP_ABC',
            })
        })
    })

    describe('filter visibility', () => {
        it('handleOpenFilter requests the filter bottom sheet', async () => {
            mockRequestBottomSheet.mockResolvedValueOnce(undefined)
            const { result } = renderHook(() =>
                useAssetTransactionList({
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
                    account: mockAccount,
                    asset: mockAsset,
                }),
            )

            expect(result.current.isError).toBe(true)
            expect(result.current.error).toBe(mockError)
        })
    })
})

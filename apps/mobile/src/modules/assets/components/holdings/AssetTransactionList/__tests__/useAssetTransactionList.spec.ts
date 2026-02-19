/*
 Copyright 2022-2025 Pera Wallet, LDA
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
import { useNetwork } from '@perawallet/wallet-core-platform-integration'
import {
    useCsvExportMutation,
    useTransactionHistoryQuery,
} from '@perawallet/wallet-core-transactions'
import { Share } from 'react-native'
import { useToast } from '@hooks/useToast'
import { TransactionFilter } from '../../../../../accounts/components/TransactionsFilterBottomSheet/types'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import type { PeraAsset } from '@perawallet/wallet-core-assets'

// Mock dependencies
vi.mock('@perawallet/wallet-core-platform-integration', () => ({
    useNetwork: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-transactions', () => ({
    useTransactionHistoryQuery: vi.fn(),
    useCsvExportMutation: vi.fn(),
}))

vi.mock('@hooks/useToast', () => ({
    useToast: vi.fn(),
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
    Share: {
        share: vi.fn(),
    },
    Platform: {
        OS: 'ios',
        select: vi.fn(),
    },
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
    const mockExportCsv = vi.fn()
    const mockFetchNextPage = vi.fn()
    const mockRefetch = vi.fn()

    beforeEach(() => {
        vi.clearAllMocks()
        mockNavigate.mockReset()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        vi.mocked(useNetwork).mockReturnValue(mockNetwork as any)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        vi.mocked(useToast).mockReturnValue({ showToast: mockShowToast } as any)

        vi.mocked(useTransactionHistoryQuery).mockReturnValue({
            transactions: [],
            isLoading: false,
            isFetchingNextPage: false,
            isError: false,
            error: null,
            hasNextPage: false,
            fetchNextPage: mockFetchNextPage,
            refetch: mockRefetch,
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

    describe('transaction grouping', () => {
        it('returns grouped transactions sections by date', () => {
            const transactions = [
                { id: '1', roundTime: 1704067200, sender: 'A' }, // 2024-01-01
                { id: '2', roundTime: 1704153600, sender: 'B' }, // 2024-01-02
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

            expect(result.current.sections).toHaveLength(2)
            expect(result.current.sections[0].date).toBe('2024-01-02')
            expect(result.current.sections[1].date).toBe('2024-01-01')
        })

        it('returns empty sections when no transactions', () => {
            const { result } = renderHook(() =>
                useAssetTransactionList({
                    account: mockAccount,
                    asset: mockAsset,
                }),
            )

            expect(result.current.sections).toHaveLength(0)
        })

        it('groups multiple transactions on same date', () => {
            const transactions = [
                { id: '1', roundTime: 1704067200, sender: 'A' },
                { id: '2', roundTime: 1704067260, sender: 'B' },
                { id: '3', roundTime: 1704067320, sender: 'C' },
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

            expect(result.current.sections).toHaveLength(1)
            expect(result.current.sections[0].data).toHaveLength(3)
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
        it('passes filter parameters to useTransactionHistoryQuery', () => {
            const { result } = renderHook(() =>
                useAssetTransactionList({
                    account: mockAccount,
                    asset: mockAsset,
                }),
            )

            act(() => {
                result.current.handleApplyFilter(TransactionFilter.Today)
            })

            expect(useTransactionHistoryQuery).toHaveBeenCalledWith(
                expect.objectContaining({
                    afterTime: expect.any(String),
                    assetId: '12345',
                }),
            )
        })

        it('updates activeFilter when handleApplyFilter is called', () => {
            const { result } = renderHook(() =>
                useAssetTransactionList({
                    account: mockAccount,
                    asset: mockAsset,
                }),
            )

            expect(result.current.activeFilter).toBe(TransactionFilter.AllTime)

            act(() => {
                result.current.handleApplyFilter(TransactionFilter.Yesterday)
            })

            expect(result.current.activeFilter).toBe(
                TransactionFilter.Yesterday,
            )
        })

        it('handles custom range filter', () => {
            const { result } = renderHook(() =>
                useAssetTransactionList({
                    account: mockAccount,
                    asset: mockAsset,
                }),
            )
            const customRange = {
                from: new Date('2024-01-01'),
                to: new Date('2024-01-15'),
            }

            act(() => {
                result.current.handleApplyFilter(
                    TransactionFilter.CustomRange,
                    customRange,
                )
            })

            expect(result.current.activeFilter).toBe(
                TransactionFilter.CustomRange,
            )
            expect(result.current.customRange).toEqual(customRange)
        })

        it('applies both date filter and asset filter', () => {
            const { result } = renderHook(() =>
                useAssetTransactionList({
                    account: mockAccount,
                    asset: mockAsset,
                }),
            )

            act(() => {
                result.current.handleApplyFilter(TransactionFilter.LastWeek)
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
        it('calls refetch when handleRefresh is called', () => {
            vi.mocked(useTransactionHistoryQuery).mockReturnValue({
                transactions: [],
                isLoading: false,
                refetch: mockRefetch,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any)

            const { result } = renderHook(() =>
                useAssetTransactionList({
                    account: mockAccount,
                    asset: mockAsset,
                }),
            )

            result.current.handleRefresh()

            expect(mockRefetch).toHaveBeenCalled()
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

        it('triggers native share upon successful export', async () => {
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
                assetId: 12345,
                rowCount: 5,
            }

            await successCallback(mockResult)

            expect(Share.share).toHaveBeenCalledWith({
                title: 'test.csv',
                message: 'data',
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

            vi.mocked(Share.share).mockRejectedValueOnce(
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
                assetId: 12345,
            })

            expect(mockShowToast).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'error',
                    body: 'Error: Share cancelled',
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

            expect(mockShowToast).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'error',
                    body: 'API Down',
                }),
            )
        })
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
                roundTime: 1704067200,
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
                transactionId: 'TX_ASSET_123',
            })
        })
    })

    describe('filter visibility', () => {
        it('isFilterVisible defaults to false', () => {
            const { result } = renderHook(() =>
                useAssetTransactionList({
                    account: mockAccount,
                    asset: mockAsset,
                }),
            )

            expect(result.current.isFilterVisible).toBe(false)
        })

        it('handleOpenFilter sets isFilterVisible to true', () => {
            const { result } = renderHook(() =>
                useAssetTransactionList({
                    account: mockAccount,
                    asset: mockAsset,
                }),
            )

            act(() => {
                result.current.handleOpenFilter()
            })

            expect(result.current.isFilterVisible).toBe(true)
        })

        it('handleCloseFilter sets isFilterVisible to false', () => {
            const { result } = renderHook(() =>
                useAssetTransactionList({
                    account: mockAccount,
                    asset: mockAsset,
                }),
            )

            act(() => {
                result.current.handleOpenFilter()
            })
            expect(result.current.isFilterVisible).toBe(true)

            act(() => {
                result.current.handleCloseFilter()
            })
            expect(result.current.isFilterVisible).toBe(false)
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

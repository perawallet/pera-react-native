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
import { useAccountHistory } from '../useAccountHistory'
import { useSelectedAccount } from '@perawallet/wallet-core-accounts'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import {
    useCsvExportMutation,
    useTransactionHistoryQuery,
} from '@perawallet/wallet-core-transactions'
import { shareCsvFile } from '@utils/shareCsvFile'
import { useToast } from '@hooks/useToast'
import { TransactionFilter } from '../../TransactionsFilterContent/types'
import { useErrorToast } from '@hooks/useErrorToast'
import { AppError } from '@perawallet/wallet-core-shared'

const mockRequestBottomSheet = vi.fn()
vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheet: () => ({ request: mockRequestBottomSheet }),
}))

// Mock dependencies
vi.mock('@perawallet/wallet-core-accounts', () => ({
    useSelectedAccount: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-blockchain', async importOriginal => {
    const actual =
        await importOriginal<
            typeof import('@perawallet/wallet-core-blockchain')
        >()
    return {
        ...actual,
        useNetwork: vi.fn(),
        useNetworkStore: { getState: () => ({ network: 'mainnet' }) },
    }
})

vi.mock('@perawallet/wallet-core-transactions', () => ({
    useTransactionHistoryQuery: vi.fn(),
    useCsvExportMutation: vi.fn(),
}))

vi.mock('@hooks/useToast', () => ({
    useToast: vi.fn(),
}))

vi.mock('@hooks/useErrorToast', () => ({
    useErrorToast: vi.fn(),
}))

vi.mock('@hooks/useAlgodErrorMessage', () => ({
    useAlgodErrorMessage: () => ({ getMessage: vi.fn() }),
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

describe('useAccountHistory', () => {
    const mockAccount = {
        address: 'VALID_ADDRESS_58_CHARS_LONG_AAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    }
    const mockNetwork = { network: 'mainnet' }
    const mockShowToast = vi.fn()
    const mockShowError = vi.fn()
    const mockExportCsv = vi.fn()
    const mockFetchNextPage = vi.fn()
    const mockRefetch = vi.fn()

    beforeEach(() => {
        vi.clearAllMocks()
        mockNavigate.mockReset()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        vi.mocked(useSelectedAccount).mockReturnValue(mockAccount as any)
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

    describe('transaction grouping', () => {
        it('returns grouped transactions sections by date', () => {
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

            expect(result.current.sections).toHaveLength(2)
            expect(result.current.sections[0].date).toBe('2024-01-02')
            expect(result.current.sections[1].date).toBe('2024-01-01')
        })

        it('returns empty sections when no transactions', () => {
            const { result } = renderHook(() => useAccountHistory())

            expect(result.current.sections).toHaveLength(0)
            expect(result.current.isEmpty).toBe(true)
        })

        it('groups multiple transactions on same date', () => {
            const transactions = [
                { id: '1', roundTime: 1_704_067_200, sender: 'A' }, // 2024-01-01 00:00
                { id: '2', roundTime: 1_704_067_260, sender: 'B' }, // 2024-01-01 00:01
                { id: '3', roundTime: 1_704_067_320, sender: 'C' }, // 2024-01-01 00:02
            ]
            vi.mocked(useTransactionHistoryQuery).mockReturnValue({
                transactions,
                isLoading: false,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any)

            const { result } = renderHook(() => useAccountHistory())

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
        it('calls refetch when handleRefresh is called', () => {
            vi.mocked(useTransactionHistoryQuery).mockReturnValue({
                transactions: [],
                isLoading: false,
                refetch: mockRefetch,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any)

            const { result } = renderHook(() => useAccountHistory())

            result.current.handleRefresh()

            expect(mockRefetch).toHaveBeenCalled()
        })
    })

    describe('CSV Export', () => {
        it('calls exportCsv when handleExportCsv is called', () => {
            const { result } = renderHook(() => useAccountHistory())

            result.current.handleExportCsv()

            expect(mockExportCsv).toHaveBeenCalledWith({
                accountAddress: mockAccount.address,
            })
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

            expect(shareCsvFile).toHaveBeenCalledWith('test.csv', 'data')
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
            vi.mocked(shareCsvFile).mockRejectedValueOnce(shareError)

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

    describe('transaction press', () => {
        it('navigates to TransactionDetails for a regular transaction without groupId', () => {
            const { result } = renderHook(() => useAccountHistory())

            const mockTransaction = {
                id: 'TX_123',
                txType: 'pay',
                sender: 'sender-address',
                receiver: 'receiver-address',
                confirmedRound: 100,
                roundTime: 1_704_067_200,
                swapGroupDetail: null,
                interpretedMeaning: null,
                fee: '1000',
                groupId: null,
                amount: '5000000',
                closeTo: null,
                asset: null,
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

        it('navigates to TransactionDetails for a non-swap transaction with groupId', () => {
            const { result } = renderHook(() => useAccountHistory())

            const mockTransaction = {
                id: 'TX_456',
                txType: 'pay',
                sender: 'sender-address',
                receiver: 'receiver-address',
                confirmedRound: 200,
                roundTime: 1_704_153_600,
                swapGroupDetail: null,
                interpretedMeaning: null,
                fee: '1000',
                groupId: 'GROUP_XYZ',
                amount: '5000000',
                closeTo: null,
                asset: null,
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

        it('navigates to GroupTransactionList for a swap transaction with groupId', () => {
            const { result } = renderHook(() => useAccountHistory())

            const mockTransaction = {
                id: 'TX_SWAP_789',
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

        it('navigates to TransactionDetails for a swap transaction without groupId', () => {
            const { result } = renderHook(() => useAccountHistory())

            const mockTransaction = {
                id: 'TX_SWAP_NO_GROUP',
                txType: 'appl',
                sender: 'sender-address',
                receiver: null,
                confirmedRound: 400,
                roundTime: 1_704_326_400,
                swapGroupDetail: {
                    amountIn: '1000000',
                    assetInUnitName: 'ALGO',
                    amountOut: '500000',
                    assetOutUnitName: 'USDC',
                },
                interpretedMeaning: null,
                fee: '2000',
                groupId: null,
                amount: null,
                closeTo: null,
                asset: null,
                applicationId: '12345',
                innerTransactionCount: 3,
            }

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            result.current.handleTransactionPress(mockTransaction as any)

            expect(mockNavigate).toHaveBeenCalledWith('TransactionDetails', {
                transactionId: mockTransaction.id,
                historyTransaction: mockTransaction,
            })
        })
    })
})

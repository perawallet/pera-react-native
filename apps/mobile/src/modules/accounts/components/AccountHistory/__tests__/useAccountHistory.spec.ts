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
import { useAccountHistory } from '../useAccountHistory'
import { useSelectedAccount } from '@perawallet/wallet-core-accounts'
import { useNetwork } from '@perawallet/wallet-core-platform-integration'
import {
    useCsvExportMutation,
    useTransactionHistoryQuery,
} from '@perawallet/wallet-core-transactions'
import { Share } from 'react-native'
import { useToast } from '@hooks/useToast'
import { TransactionFilter } from '../../TransactionsFilterBottomSheet/types'

// Mock dependencies
vi.mock('@perawallet/wallet-core-accounts', () => ({
    useSelectedAccount: vi.fn(),
}))

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

vi.mock('react-native', () => ({
    Share: {
        share: vi.fn(),
    },
    Platform: {
        OS: 'ios',
        select: vi.fn(),
    },
}))

describe('useAccountHistory', () => {
    const mockAccount = {
        address: 'VALID_ADDRESS_58_CHARS_LONG_AAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    }
    const mockNetwork = { network: 'mainnet' }
    const mockShowToast = vi.fn()
    const mockExportCsv = vi.fn()
    const mockFetchNextPage = vi.fn()
    const mockRefetch = vi.fn()

    beforeEach(() => {
        vi.clearAllMocks()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        vi.mocked(useSelectedAccount).mockReturnValue(mockAccount as any)
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
                { id: '1', roundTime: 1704067200, sender: 'A' }, // 2024-01-01 00:00
                { id: '2', roundTime: 1704067260, sender: 'B' }, // 2024-01-01 00:01
                { id: '3', roundTime: 1704067320, sender: 'C' }, // 2024-01-01 00:02
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
        it('passes filter parameters to useTransactionHistoryQuery', () => {
            const { result } = renderHook(() => useAccountHistory())

            act(() => {
                result.current.handleApplyFilter(TransactionFilter.Today)
            })

            expect(useTransactionHistoryQuery).toHaveBeenCalledWith(
                expect.objectContaining({
                    afterTime: expect.any(String),
                }),
            )
        })

        it('updates activeFilter when handleApplyFilter is called', () => {
            const { result } = renderHook(() => useAccountHistory())

            expect(result.current.activeFilter).toBe(TransactionFilter.AllTime)

            act(() => {
                result.current.handleApplyFilter(TransactionFilter.Yesterday)
            })

            expect(result.current.activeFilter).toBe(
                TransactionFilter.Yesterday,
            )
        })

        it('handles custom range filter', () => {
            const { result } = renderHook(() => useAccountHistory())
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

            renderHook(() => useAccountHistory())

            const mockResult = {
                filename: 'test.csv',
                csvContent: 'data',
                accountAddress: 'addr',
                rowCount: 1,
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

            renderHook(() => useAccountHistory())

            await successCallback({ filename: 'f', csvContent: 'c' })

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

            renderHook(() => useAccountHistory())

            errorCallback(new Error('API Down'))

            expect(mockShowToast).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'error',
                    body: 'API Down',
                }),
            )
        })
    })
})

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
import { renderHook } from '@testing-library/react'
import { useAccountHistory } from '../useAccountHistory'
import { useSelectedAccount } from '@perawallet/wallet-core-accounts'
import { useNetwork } from '@perawallet/wallet-core-platform-integration'
import {
    useCsvExportMutation,
    useTransactionHistoryQuery,
} from '@perawallet/wallet-core-transactions'
import { Share } from 'react-native'
import { useToast } from '@hooks/useToast'

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
}))

describe('useAccountHistory', () => {
    const mockAccount = {
        address: 'VALID_ADDRESS_58_CHARS_LONG_AAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    }
    const mockNetwork = { network: 'mainnet' }
    const mockShowToast = vi.fn()
    const mockExportCsv = vi.fn()

    beforeEach(() => {
        vi.clearAllMocks()
        vi.mocked(useSelectedAccount).mockReturnValue(mockAccount as any) // eslint-disable-line @typescript-eslint/no-explicit-any
        vi.mocked(useNetwork).mockReturnValue(mockNetwork as any) // eslint-disable-line @typescript-eslint/no-explicit-any
        vi.mocked(useToast).mockReturnValue({ showToast: mockShowToast } as any) // eslint-disable-line @typescript-eslint/no-explicit-any

        vi.mocked(useTransactionHistoryQuery).mockReturnValue({
            transactions: [],
            isLoading: false,
            isFetchingNextPage: false,
            isError: false,
            error: null,
            hasNextPage: false,
            fetchNextPage: vi.fn(),
            refetch: vi.fn(),
        } as any) // eslint-disable-line @typescript-eslint/no-explicit-any

        vi.mocked(useCsvExportMutation).mockReturnValue({
            exportCsv: mockExportCsv,
            isLoading: false,
            isError: false,
            error: null,
            isSuccess: false,
            result: null,
            reset: vi.fn(),
        } as any) // eslint-disable-line @typescript-eslint/no-explicit-any
    })

    it('returns grouped transactions sections', () => {
        const transactions = [
            { id: '1', roundTime: 1704067200, sender: 'A' }, // 2024-01-01
            { id: '2', roundTime: 1704153600, sender: 'B' }, // 2024-01-02
        ]
        vi.mocked(useTransactionHistoryQuery).mockReturnValue({
            transactions,
            isLoading: false,
        } as any) // eslint-disable-line @typescript-eslint/no-explicit-any

        const { result } = renderHook(() => useAccountHistory())

        expect(result.current.sections).toHaveLength(2)
        expect(result.current.sections[0].date).toBe('2024-01-02')
        expect(result.current.sections[1].date).toBe('2024-01-01')
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

        it('triggers native share upon successful export', async () => {
            let successCallback: (result: any) => Promise<void> = async () => { } // eslint-disable-line @typescript-eslint/no-explicit-any
            vi.mocked(useCsvExportMutation).mockImplementation(
                ({ onSuccess }: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
                    successCallback = onSuccess
                    return {
                        exportCsv: mockExportCsv,
                        isLoading: false,
                    } as any // eslint-disable-line @typescript-eslint/no-explicit-any
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
            let successCallback: (result: any) => Promise<void> = async () => { } // eslint-disable-line @typescript-eslint/no-explicit-any
            vi.mocked(useCsvExportMutation).mockImplementation(
                ({ onSuccess }: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
                    successCallback = onSuccess
                    return {
                        exportCsv: mockExportCsv,
                        isLoading: false,
                    } as any // eslint-disable-line @typescript-eslint/no-explicit-any
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
            let errorCallback: (error: any) => void = () => { } // eslint-disable-line @typescript-eslint/no-explicit-any
            vi.mocked(useCsvExportMutation).mockImplementation(
                ({ onError }: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
                    errorCallback = onError
                    return {
                        exportCsv: mockExportCsv,
                        isLoading: false,
                    } as any // eslint-disable-line @typescript-eslint/no-explicit-any
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

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
import { renderHook, waitFor, act } from '@testing-library/react'
import { useCsvExportMutation } from '../useCsvExportMutation'
import { fetchTransactionsCsv, CsvExportError } from '../../api/csv-export'
import { Networks } from '@perawallet/wallet-core-shared'
import { Networks as ConfigNetworks } from '@perawallet/wallet-core-config'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

// Mock the API function
vi.mock('../../api/csv-export', async importOriginal => {
    const actual = await importOriginal<typeof import('../../api/csv-export')>()
    return {
        ...actual,
        fetchTransactionsCsv: vi.fn(),
    }
})

const createWrapper = () => {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: { retry: false },
            mutations: { retry: false },
        },
    })
    return ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>
            {' '}
            {children}{' '}
        </QueryClientProvider>
    )
}

describe('useCsvExportMutation', () => {
    const mockOnSuccess = vi.fn()
    const mockOnError = vi.fn()
    const VALID_ADDRESS =
        'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HFKQ'

    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('successfully exports CSV', async () => {
        const mockResult = {
            csvContent: 'date,amount\n2024-01-01,1000',
            filename: 'export.csv',
            accountAddress: VALID_ADDRESS,
            rowCount: 1,
        }
        vi.mocked(fetchTransactionsCsv).mockResolvedValueOnce(mockResult)

        const { result } = renderHook(
            () =>
                useCsvExportMutation({
                    network: Networks.mainnet,
                    onSuccess: mockOnSuccess,
                    onError: mockOnError,
                }),
            { wrapper: createWrapper() },
        )

        result.current.exportCsv({ accountAddress: VALID_ADDRESS })

        await waitFor(() => expect(result.current.isSuccess).toBe(true))

        expect(result.current.result).toEqual(mockResult)
        expect(mockOnSuccess).toHaveBeenCalledWith(mockResult)
        expect(mockOnError).not.toHaveBeenCalled()
        expect(fetchTransactionsCsv).toHaveBeenCalledWith({
            accountAddress: VALID_ADDRESS,
            dateRange: undefined,
            filename: undefined,
            network: Networks.mainnet,
        })
    })

    it('handles export error', async () => {
        const mockError = new CsvExportError('Export failed', 500)
        vi.mocked(fetchTransactionsCsv).mockRejectedValueOnce(mockError)

        const { result } = renderHook(
            () =>
                useCsvExportMutation({
                    network: Networks.mainnet,
                    onSuccess: mockOnSuccess,
                    onError: mockOnError,
                }),
            { wrapper: createWrapper() },
        )

        result.current.exportCsv({ accountAddress: VALID_ADDRESS })

        await waitFor(() => expect(result.current.isError).toBe(true))

        expect(result.current.error).toBeInstanceOf(CsvExportError)
        expect(result.current.error?.message).toBe('Export failed')
        expect(mockOnError).toHaveBeenCalledWith(expect.any(CsvExportError))
        expect(mockOnSuccess).not.toHaveBeenCalled()
    })

    it('handles unexpected errors by wrapping them in CsvExportError', async () => {
        const unexpectedError = new Error('Network crash')
        vi.mocked(fetchTransactionsCsv).mockRejectedValueOnce(unexpectedError)

        const { result } = renderHook(
            () =>
                useCsvExportMutation({
                    network: Networks.mainnet,
                    onSuccess: mockOnSuccess,
                    onError: mockOnError,
                }),
            { wrapper: createWrapper() },
        )

        result.current.exportCsv({ accountAddress: VALID_ADDRESS })

        await waitFor(() => expect(result.current.isError).toBe(true))

        expect(result.current.error).toBeInstanceOf(CsvExportError)
        expect(result.current.error?.message).toBe('Network crash')
    })

    it('correctly reports loading state', async () => {
        vi.mocked(fetchTransactionsCsv).mockImplementation(
            () =>
                new Promise(resolve =>
                    setTimeout(() => resolve({} as any), 100),
                ),
        )

        const { result } = renderHook(
            () =>
                useCsvExportMutation({
                    network: Networks.mainnet,
                }),
            { wrapper: createWrapper() },
        )

        act(() => {
            result.current.exportCsv({ accountAddress: VALID_ADDRESS })
        })

        await waitFor(() => expect(result.current.isLoading).toBe(true))
        await waitFor(() => expect(result.current.isLoading).toBe(false))
    })

    it('resets state correctly', async () => {
        vi.mocked(fetchTransactionsCsv).mockResolvedValueOnce({} as any)

        const { result } = renderHook(
            () =>
                useCsvExportMutation({
                    network: Networks.mainnet,
                }),
            { wrapper: createWrapper() },
        )

        act(() => {
            result.current.exportCsv({ accountAddress: VALID_ADDRESS })
        })

        await waitFor(() => expect(result.current.isSuccess).toBe(true))

        act(() => {
            result.current.reset()
        })

        await waitFor(() => expect(result.current.isSuccess).toBe(false))
        expect(result.current.result).toBeNull()
    })

    it('passes assetId as string to fetchTransactionsCsv', async () => {
        const mockResult = {
            csvContent: 'date,amount\n2024-01-01,1000',
            filename: 'export.csv',
            accountAddress: VALID_ADDRESS,
            rowCount: 1,
            assetId: '12345',
        }
        vi.mocked(fetchTransactionsCsv).mockResolvedValueOnce(mockResult)

        const { result } = renderHook(
            () =>
                useCsvExportMutation({
                    network: Networks.mainnet,
                    onSuccess: mockOnSuccess,
                }),
            { wrapper: createWrapper() },
        )

        act(() => {
            result.current.exportCsv({
                accountAddress: VALID_ADDRESS,
                assetId: '12345',
            })
        })

        await waitFor(() => expect(result.current.isSuccess).toBe(true))

        expect(fetchTransactionsCsv).toHaveBeenCalledWith({
            accountAddress: VALID_ADDRESS,
            dateRange: undefined,
            filename: undefined,
            assetId: '12345',
            network: Networks.mainnet,
        })
        expect(result.current.result?.assetId).toBe('12345')
    })

    describe('non-Pera-backed networks', () => {
        it.each([ConfigNetworks.betanet, ConfigNetworks.custom])(
            'reports isUnavailableOnNetwork and no-ops exportCsv on %s',
            async network => {
                const { result, rerender } = renderHook(
                    () =>
                        useCsvExportMutation({
                            network,
                            onSuccess: mockOnSuccess,
                            onError: mockOnError,
                        }),
                    { wrapper: createWrapper() },
                )

                expect(result.current.isUnavailableOnNetwork).toBe(true)

                const firstExportCsv = result.current.exportCsv
                act(() => {
                    result.current.exportCsv({ accountAddress: VALID_ADDRESS })
                })

                expect(fetchTransactionsCsv).not.toHaveBeenCalled()
                expect(mockOnSuccess).not.toHaveBeenCalled()
                expect(mockOnError).not.toHaveBeenCalled()

                rerender()
                expect(result.current.exportCsv).toBe(firstExportCsv)
            },
        )

        it.each([Networks.mainnet, Networks.testnet])(
            'reports isUnavailableOnNetwork as false on %s',
            network => {
                const { result } = renderHook(
                    () => useCsvExportMutation({ network }),
                    { wrapper: createWrapper() },
                )

                expect(result.current.isUnavailableOnNetwork).toBe(false)
            },
        )
    })
})

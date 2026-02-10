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

import { useMutation } from '@tanstack/react-query'
import type { Network } from '@perawallet/wallet-core-shared'
import {
    fetchTransactionsCsv,
    CsvExportError,
    type DateRange,
    type CsvExportResult,
} from '../api/csv-export'

/**
 * Parameters for the useCsvExportMutation hook.
 */
export type UseCsvExportMutationParams = {
    /** The network to export from */
    network: Network
    /** Callback when export succeeds - receives the result for sharing */
    onSuccess?: (result: CsvExportResult) => void
    /** Callback when export fails */
    onError?: (error: CsvExportError) => void
}

/**
 * Parameters for the export mutation function.
 */
export type ExportMutationParams = {
    /** The Algorand account address to export */
    accountAddress: string
    /** Optional date range filter */
    dateRange?: DateRange
    /** Optional custom filename */
    filename?: string
}

/**
 * Return type for useCsvExportMutation.
 * Provides a clean API for exporting CSV.
 */
export type UseCsvExportMutationResult = {
    /** Function to trigger the export */
    exportCsv: (params: ExportMutationParams) => void
    /** Whether the export is in progress */
    isLoading: boolean
    /** Whether there was an error */
    isError: boolean
    /** The error if one occurred */
    error: CsvExportError | null
    /** Whether the export completed successfully */
    isSuccess: boolean
    /** The result if export succeeded */
    result: CsvExportResult | null
    /** Reset mutation state */
    reset: () => void
}

/**
 * Hook for exporting transaction history to CSV.
 *
 * This hook provides a mutation for fetching transaction history as CSV.
 * After a successful export, use the onSuccess callback to trigger
 * the platform share functionality.
 *
 * @example
 * ```tsx
 * import { Share } from 'react-native'
 * import { useCsvExportMutation } from '@perawallet/wallet-core-transactions'
 *
 * const MyComponent = () => {
 *     const { exportCsv, isLoading } = useCsvExportMutation({
 *         network: 'mainnet',
 *         onSuccess: async (result) => {
 *             await Share.share({
 *                 title: `Transactions - ${result.accountAddress}`,
 *                 message: result.csvContent,
 *             })
 *         },
 *     })
 *
 *     return (
 *         <Button
 *             title="Export CSV"
 *             onPress={() => exportCsv({ accountAddress: 'ABC...' })}
 *             disabled={isLoading}
 *         />
 *     )
 * }
 * ```
 */
export const useCsvExportMutation = (
    params: UseCsvExportMutationParams,
): UseCsvExportMutationResult => {
    const { network, onSuccess, onError } = params

    const mutation = useMutation({
        mutationFn: async (exportParams: ExportMutationParams) => {
            return fetchTransactionsCsv({
                accountAddress: exportParams.accountAddress,
                dateRange: exportParams.dateRange,
                filename: exportParams.filename,
                network,
            })
        },
        onSuccess: result => {
            onSuccess?.(result)
        },
        onError: error => {
            if (error instanceof CsvExportError) {
                onError?.(error)
            } else {
                onError?.(
                    new CsvExportError(
                        error instanceof Error
                            ? error.message
                            : 'Unknown error',
                    ),
                )
            }
        },
    })

    return {
        exportCsv: mutation.mutate,
        isLoading: mutation.isPending,
        isError: mutation.isError,
        error:
            mutation.error instanceof CsvExportError
                ? mutation.error
                : mutation.error
                  ? new CsvExportError(mutation.error.message)
                  : null,
        isSuccess: mutation.isSuccess,
        result: mutation.data ?? null,
        reset: mutation.reset,
    }
}

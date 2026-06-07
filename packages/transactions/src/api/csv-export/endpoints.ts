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

import { type Network, queryClient } from '@perawallet/wallet-core-shared'
import type { ExportCsvParams, CsvExportResult } from './types'
import { generateFilename, buildCsvQueryParams, countCsvRows } from './utils'

/**
 * Custom error class for CSV export operations.
 */
export class CsvExportError extends Error {
    public statusCode?: number
    public url?: string
    public originalError?: Error

    constructor(
        message: string,
        statusCode?: number,
        url?: string,
        originalError?: Error,
    ) {
        super(message)
        this.name = 'CsvExportError'
        this.statusCode = statusCode
        this.url = url
        this.originalError = originalError
    }
}

/**
 * Parameters for the fetch CSV endpoint.
 */
export type FetchCsvParams = ExportCsvParams & {
    /** The network to fetch from (mainnet or testnet) */
    network: Network
    /** Optional: AbortSignal for cancellation */
    signal?: AbortSignal
}

/**
 * Fetches transaction history CSV from the Pera API.
 *
 * This function uses queryClient for networking.
 * Returns the raw CSV content along with metadata.
 *
 * @param params - Export parameters including address, network, date range
 * @returns CsvExportResult with the CSV data and metadata
 * @throws CsvExportError if the export fails
 */
export const fetchTransactionsCsv = async (
    params: FetchCsvParams,
): Promise<CsvExportResult> => {
    const { accountAddress, network, dateRange, filename, signal, assetId } =
        params

    // Validate address format (Algorand addresses are 58 characters)
    if (!accountAddress || accountAddress.length !== 58) {
        throw new CsvExportError(
            `Invalid account address: ${accountAddress}. Expected 58-character base32 address.`,
        )
    }

    const finalFilename = generateFilename(accountAddress, filename)
    const endpoint = `/v1/accounts/${encodeURIComponent(accountAddress)}/export-history/`

    // Build query string
    const queryParams = buildCsvQueryParams(dateRange, assetId)

    try {
        const response = await queryClient<string>({
            backend: 'pera',
            network,
            method: 'GET',
            url: endpoint,
            params: queryParams,
            signal,
            responseType: 'text',
        })

        const csvContent = response.data

        if (!csvContent || csvContent.trim().length === 0) {
            throw new CsvExportError(
                'Empty CSV content received from API',
                response.status,
                endpoint,
            )
        }

        const rowCount = countCsvRows(csvContent)

        return {
            csvContent,
            filename: finalFilename,
            accountAddress,
            dateRange,
            rowCount,
            assetId,
        }
    } catch (error) {
        if (error instanceof CsvExportError) {
            throw error
        }

        if (error instanceof Error) {
            throw new CsvExportError(
                `Failed to export transactions: ${error.message}`,
                undefined,
                endpoint,
                error,
            )
        }

        throw new CsvExportError(
            'An unknown error occurred while exporting transactions',
            undefined,
            endpoint,
        )
    }
}

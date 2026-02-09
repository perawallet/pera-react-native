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

import ky, { type KyRequest, type HTTPError, type BeforeRetryState } from 'ky'
import { config } from '@perawallet/wallet-core-config'
import { Network, Networks, logger } from '@perawallet/wallet-core-shared'
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
 * Gets the base URL for the given network.
 */
const getBaseUrl = (network: Network): string => {
    return network === Networks.mainnet
        ? config.mainnetBackendUrl
        : config.testnetBackendUrl
}

/**
 * Creates a ky instance with proper configuration for CSV export.
 * Uses ky for retry logic, error handling, and consistent API key setup.
 */
const createCsvClient = (baseUrl: string) => {
    return ky.create({
        prefixUrl: baseUrl,
        retry: {
            limit: 2,
            methods: ['get'],
            statusCodes: [408, 413, 429, 500, 502, 503, 504],
        },
        timeout: 30000, // 30 second timeout for large exports
        hooks: {
            beforeRequest: [
                (request: KyRequest) => {
                    request.headers.set('Accept', '*/*')
                    if (config.backendAPIKey) {
                        request.headers.set('X-API-Key', config.backendAPIKey)
                    }
                },
            ],
            beforeError: [
                (error: HTTPError) => {
                    logger.error('CSV export request error', {
                        message: error.message,
                        status: error.response?.status,
                    })
                    return error
                },
            ],
            beforeRetry: [
                ({ request, retryCount, error }: BeforeRetryState) => {
                    logger.debug('Retrying CSV export request', {
                        url: request.url,
                        retryCount,
                        errorMessage: error.message,
                    })
                },
            ],
        },
    })
}

/**
 * Fetches transaction history CSV from the Pera API.
 *
 * This function uses ky HTTP client with retry logic and proper error handling.
 * Returns the raw CSV content along with metadata.
 *
 * @param params - Export parameters including address, network, date range
 * @returns CsvExportResult with the CSV data and metadata
 * @throws CsvExportError if the export fails
 */
export const fetchTransactionsCsv = async (
    params: FetchCsvParams,
): Promise<CsvExportResult> => {
    const { accountAddress, network, dateRange, filename, signal } = params

    // Validate address format (Algorand addresses are 58 characters)
    if (!accountAddress || accountAddress.length !== 58) {
        throw new CsvExportError(
            `Invalid account address: ${accountAddress}. Expected 58-character base32 address.`,
        )
    }

    const finalFilename = generateFilename(accountAddress, filename)
    const baseUrl = getBaseUrl(network)
    const endpoint = `v1/accounts/${encodeURIComponent(accountAddress)}/export-history/`

    // Build query string
    const queryParams = buildCsvQueryParams(dateRange)
    const url = `${baseUrl}/${endpoint}`

    try {
        const client = createCsvClient(baseUrl)
        const response = await client.get(endpoint, {
            searchParams: queryParams,
            signal,
        })

        const csvContent = await response.text()

        if (!csvContent || csvContent.trim().length === 0) {
            throw new CsvExportError(
                'Empty CSV content received from API',
                response.status,
                url,
            )
        }

        const rowCount = countCsvRows(csvContent)

        return {
            csvContent,
            filename: finalFilename,
            accountAddress,
            dateRange,
            rowCount,
        }
    } catch (error) {
        if (error instanceof CsvExportError) {
            throw error
        }

        if (error instanceof Error) {
            throw new CsvExportError(
                `Failed to export transactions: ${error.message}`,
                undefined,
                url,
                error,
            )
        }

        throw new CsvExportError(
            'An unknown error occurred while exporting transactions',
            undefined,
            url,
        )
    }
}

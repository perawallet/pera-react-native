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

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchTransactionsCsv, CsvExportError } from '../endpoints'
import { Networks } from '@perawallet/wallet-core-shared'

// Track the last queryClient call for assertions
let lastQueryClientCall: any = null
let mockGetResponse: { data: string; status: number } | null = null
let mockGetError: Error | null = null

// Mock the config module
vi.mock('@perawallet/wallet-core-config', () => ({
    config: {
        mainnetBackendUrl: 'https://mainnet.api.perawallet.app',
        testnetBackendUrl: 'https://testnet.api.perawallet.app',
        backendAPIKey: 'test-api-key',
    },
}))

// Mock the core shared module
vi.mock('@perawallet/wallet-core-shared', async () => {
    const actual =
        await vi.importActual<
            typeof import('@perawallet/wallet-core-shared')
        >('@perawallet/wallet-core-shared')
    return {
        ...actual,
        queryClient: vi.fn(async (config: any) => {
            lastQueryClientCall = config
            if (mockGetError) {
                throw mockGetError
            }
            return mockGetResponse
        }),
        logger: {
            error: vi.fn(),
            debug: vi.fn(),
        },
    }
})

const VALID_ADDRESS =
    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HFKQ'
const MOCK_CSV_CONTENT = `Date,Type,Amount,Asset
2024-01-15,pay,1000000,ALGO
2024-01-16,axfer,500,USDC`

describe('fetchTransactionsCsv', () => {
    beforeEach(() => {
        lastQueryClientCall = null
        mockGetError = null
        mockGetResponse = {
            data: MOCK_CSV_CONTENT,
            status: 200,
        }
    })

    afterEach(() => {
        vi.clearAllMocks()
    })

    it('fetches CSV successfully', async () => {
        const result = await fetchTransactionsCsv({
            accountAddress: VALID_ADDRESS,
            network: Networks.mainnet,
        })

        expect(result.csvContent).toBe(MOCK_CSV_CONTENT)
        expect(result.accountAddress).toBe(VALID_ADDRESS)
        expect(result.rowCount).toBe(2)
        expect(result.filename).toBe(`${VALID_ADDRESS}.csv`)
    })

    it('calls ky with correct endpoint', async () => {
        await fetchTransactionsCsv({
            accountAddress: VALID_ADDRESS,
            network: Networks.mainnet,
        })

        expect(lastQueryClientCall).not.toBeNull()
        expect(lastQueryClientCall?.url).toContain(VALID_ADDRESS)
        expect(lastQueryClientCall?.url).toContain('export-history')
    })

    it('includes date range in search params', async () => {
        await fetchTransactionsCsv({
            accountAddress: VALID_ADDRESS,
            network: Networks.mainnet,
            dateRange: {
                startDate: '2024-01-01',
                endDate: '2024-12-31',
            },
        })

        expect(lastQueryClientCall?.params).toEqual({
            start_date: '2024-01-01',
            end_date: '2024-12-31',
        })
    })

    it('uses custom filename when provided', async () => {
        const result = await fetchTransactionsCsv({
            accountAddress: VALID_ADDRESS,
            network: Networks.mainnet,
            filename: 'my-export',
        })

        expect(result.filename).toBe('my-export.csv')
    })

    it('throws CsvExportError for invalid address', async () => {
        await expect(
            fetchTransactionsCsv({
                accountAddress: 'invalid',
                network: Networks.mainnet,
            }),
        ).rejects.toThrow(CsvExportError)
    })

    it('throws CsvExportError for network errors', async () => {
        mockGetError = new Error('Network failure')

        await expect(
            fetchTransactionsCsv({
                accountAddress: VALID_ADDRESS,
                network: Networks.mainnet,
            }),
        ).rejects.toThrow(CsvExportError)
    })

    it('throws CsvExportError for empty response', async () => {
        mockGetResponse = {
            data: '',
            status: 200,
        }

        await expect(
            fetchTransactionsCsv({
                accountAddress: VALID_ADDRESS,
                network: Networks.mainnet,
            }),
        ).rejects.toThrow(CsvExportError)
    })

    it('passes signal to ky options', async () => {
        const controller = new AbortController()

        await fetchTransactionsCsv({
            accountAddress: VALID_ADDRESS,
            network: Networks.mainnet,
            signal: controller.signal,
        })

        expect(lastQueryClientCall?.signal).toBe(controller.signal)
    })
})

describe('CsvExportError', () => {
    it('includes status code and URL', () => {
        const error = new CsvExportError(
            'Test error',
            404,
            'https://example.com',
        )

        expect(error.message).toBe('Test error')
        expect(error.statusCode).toBe(404)
        expect(error.url).toBe('https://example.com')
        expect(error.name).toBe('CsvExportError')
    })

    it('includes original error', () => {
        const originalError = new Error('Original')
        const error = new CsvExportError(
            'Wrapped error',
            undefined,
            undefined,
            originalError,
        )

        expect(error.originalError).toBe(originalError)
    })
})

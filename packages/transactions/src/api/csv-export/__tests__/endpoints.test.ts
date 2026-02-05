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

// Mock the config module
vi.mock('@perawallet/wallet-core-config', () => ({
    config: {
        mainnetBackendUrl: 'https://mainnet.api.perawallet.app',
        testnetBackendUrl: 'https://testnet.api.perawallet.app',
        backendAPIKey: 'test-api-key',
    },
}))

// Mock fetch globally
const mockFetch = vi.fn()
;(globalThis as any).fetch = mockFetch

const VALID_ADDRESS =
    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HFKQ'
const MOCK_CSV_CONTENT = `Date,Type,Amount,Asset
2024-01-15,pay,1000000,ALGO
2024-01-16,axfer,500,USDC`

describe('fetchTransactionsCsv', () => {
    beforeEach(() => {
        mockFetch.mockReset()
    })

    afterEach(() => {
        vi.clearAllMocks()
    })

    it('fetches CSV successfully', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            text: () => Promise.resolve(MOCK_CSV_CONTENT),
        })

        const result = await fetchTransactionsCsv({
            accountAddress: VALID_ADDRESS,
            network: Networks.mainnet,
        })

        expect(result.csvContent).toBe(MOCK_CSV_CONTENT)
        expect(result.accountAddress).toBe(VALID_ADDRESS)
        expect(result.rowCount).toBe(2)
        expect(result.filename).toBe(`${VALID_ADDRESS}.csv`)
    })

    it('includes API key in headers', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            text: () => Promise.resolve(MOCK_CSV_CONTENT),
        })

        await fetchTransactionsCsv({
            accountAddress: VALID_ADDRESS,
            network: Networks.mainnet,
        })

        expect(mockFetch).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({
                headers: expect.objectContaining({
                    'X-API-Key': 'test-api-key',
                    Accept: '*/*',
                }),
            }),
        )
    })

    it('includes date range in query params', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            text: () => Promise.resolve(MOCK_CSV_CONTENT),
        })

        await fetchTransactionsCsv({
            accountAddress: VALID_ADDRESS,
            network: Networks.mainnet,
            dateRange: {
                startDate: '2024-01-01',
                endDate: '2024-12-31',
            },
        })

        const calledUrl = mockFetch.mock.calls[0][0]
        expect(calledUrl).toContain('start_date=2024-01-01')
        expect(calledUrl).toContain('end_date=2024-12-31')
    })

    it('uses custom filename when provided', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            text: () => Promise.resolve(MOCK_CSV_CONTENT),
        })

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

    it('throws CsvExportError for HTTP errors', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 404,
            statusText: 'Not Found',
        })

        await expect(
            fetchTransactionsCsv({
                accountAddress: VALID_ADDRESS,
                network: Networks.mainnet,
            }),
        ).rejects.toThrow(CsvExportError)
    })

    it('throws CsvExportError for empty response', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            text: () => Promise.resolve(''),
        })

        await expect(
            fetchTransactionsCsv({
                accountAddress: VALID_ADDRESS,
                network: Networks.mainnet,
            }),
        ).rejects.toThrow(CsvExportError)
    })

    it('uses testnet URL for testnet network', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            text: () => Promise.resolve(MOCK_CSV_CONTENT),
        })

        await fetchTransactionsCsv({
            accountAddress: VALID_ADDRESS,
            network: Networks.testnet,
        })

        const calledUrl = mockFetch.mock.calls[0][0]
        expect(calledUrl).toContain('testnet.api.perawallet.app')
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

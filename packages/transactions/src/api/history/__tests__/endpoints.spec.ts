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
import { Networks } from '@perawallet/wallet-core-shared'

// Mock the queryClient using vi.hoisted to avoid hoisting issues
const mockQueryClient = vi.hoisted(() => vi.fn())

vi.mock('@perawallet/wallet-core-shared', async () => {
    const actual = await vi.importActual<
        typeof import('@perawallet/wallet-core-shared')
    >('@perawallet/wallet-core-shared')
    return {
        ...actual,
        queryClient: mockQueryClient,
    }
})

// Fully replaced (no `importActual`): the real `@perawallet/wallet-core-assets`
// barrel transitively pulls in react-native-mmkv, which cannot resolve under
// this package's jsdom test environment (same class of issue as the
// `@perawallet/wallet-core-blockchain` mock in
// `useRekeyFeePreflight.spec.ts` and the provider stub in `vitest.setup.ts`).
// `./indexer/endpoints` only imports these two named exports, and the routing
// tests below that reach the indexer path use empty transaction pages, so
// neither mock needs a return value configured.
vi.mock('@perawallet/wallet-core-assets', () => ({
    fetchIndexerAssetDetails: vi.fn(),
    transformIndexerAssetResponse: vi.fn(),
}))

// Import after mocks are set up
const { fetchTransactionHistory, fetchMoreTransactions } =
    await import('../endpoints')

// Mock the schema parser
vi.mock('../schema', () => ({
    transactionHistoryResponseSchema: {
        parse: vi.fn(data => data),
    },
}))

// Mock the transformers
vi.mock('../transformers', () => ({
    transformTransactionHistoryResponse: vi.fn(data => ({
        transactions: data.results || [],
        pagination: {
            nextUrl: data.next || null,
            previousUrl: data.previous || null,
        },
    })),
}))

describe('fetchTransactionHistory', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('should call queryClient with correct base parameters', async () => {
        const mockResponse = {
            data: {
                results: [],
                next: null,
                previous: null,
            },
            status: 200,
            statusText: 'OK',
        }

        mockQueryClient.mockResolvedValue(mockResponse)

        await fetchTransactionHistory({
            accountAddress: 'ABC123DEF456',
            network: Networks.mainnet,
        })

        expect(mockQueryClient).toHaveBeenCalledWith({
            backend: 'pera',
            network: Networks.mainnet,
            method: 'GET',
            url: '/v1/accounts/ABC123DEF456/transactions/',
            params: {
                limit: 25, // DEFAULT_ITEMS_PER_PAGE
            },
            signal: undefined,
        })
    })

    it('should pass assetId as asset_id parameter', async () => {
        const mockResponse = {
            data: {
                results: [],
                next: null,
                previous: null,
            },
            status: 200,
            statusText: 'OK',
        }

        mockQueryClient.mockResolvedValue(mockResponse)

        // Above 2^53: must pass through as a string, unrounded.
        const bigId = '18446744073709551615' // 2^64 - 1
        await fetchTransactionHistory({
            accountAddress: 'ABC123DEF456',
            network: Networks.mainnet,
            assetId: bigId,
        })

        expect(mockQueryClient).toHaveBeenCalledWith(
            expect.objectContaining({
                params: expect.objectContaining({
                    asset_id: bigId,
                }),
            }),
        )
    })

    it('should pass afterTime as after_time parameter (not start_date)', async () => {
        const mockResponse = {
            data: {
                results: [],
                next: null,
                previous: null,
            },
            status: 200,
            statusText: 'OK',
        }

        mockQueryClient.mockResolvedValue(mockResponse)

        await fetchTransactionHistory({
            accountAddress: 'ABC123DEF456',
            network: Networks.mainnet,
            afterTime: '2025-02-01',
        })

        const callParams = mockQueryClient.mock.calls[0][0].params

        // Should have after_time, NOT start_date
        expect(callParams).toHaveProperty('after_time', '2025-02-01')
        expect(callParams).not.toHaveProperty('start_date')
    })

    it('should pass beforeTime as before_time parameter (not end_date)', async () => {
        const mockResponse = {
            data: {
                results: [],
                next: null,
                previous: null,
            },
            status: 200,
            statusText: 'OK',
        }

        mockQueryClient.mockResolvedValue(mockResponse)

        await fetchTransactionHistory({
            accountAddress: 'ABC123DEF456',
            network: Networks.mainnet,
            beforeTime: '2025-02-13',
        })

        const callParams = mockQueryClient.mock.calls[0][0].params

        // Should have before_time, NOT end_date
        expect(callParams).toHaveProperty('before_time', '2025-02-13')
        expect(callParams).not.toHaveProperty('end_date')
    })

    it('should pass all filter parameters together correctly', async () => {
        const mockResponse = {
            data: {
                results: [],
                next: null,
                previous: null,
            },
            status: 200,
            statusText: 'OK',
        }

        mockQueryClient.mockResolvedValue(mockResponse)

        await fetchTransactionHistory({
            accountAddress: 'ABC123DEF456',
            network: Networks.testnet,
            assetId: '31566704',
            afterTime: '2025-02-01',
            beforeTime: '2025-02-13',
            limit: 50,
        })

        expect(mockQueryClient).toHaveBeenCalledWith({
            backend: 'pera',
            network: Networks.testnet,
            method: 'GET',
            url: '/v1/accounts/ABC123DEF456/transactions/',
            params: {
                limit: 50,
                asset_id: '31566704',
                after_time: '2025-02-01',
                before_time: '2025-02-13',
            },
            signal: undefined,
        })
    })

    it('should handle signal parameter for request cancellation', async () => {
        const mockResponse = {
            data: {
                results: [],
                next: null,
                previous: null,
            },
            status: 200,
            statusText: 'OK',
        }

        mockQueryClient.mockResolvedValue(mockResponse)

        const abortController = new AbortController()

        await fetchTransactionHistory({
            accountAddress: 'ABC123DEF456',
            network: Networks.mainnet,
            signal: abortController.signal,
        })

        expect(mockQueryClient).toHaveBeenCalledWith(
            expect.objectContaining({
                signal: abortController.signal,
            }),
        )
    })

    it('should encode account address in URL', async () => {
        const mockResponse = {
            data: {
                results: [],
                next: null,
                previous: null,
            },
            status: 200,
            statusText: 'OK',
        }

        mockQueryClient.mockResolvedValue(mockResponse)

        await fetchTransactionHistory({
            accountAddress: 'ABC+123/DEF=456',
            network: Networks.mainnet,
        })

        // encodeURIComponent should encode special characters
        expect(mockQueryClient).toHaveBeenCalledWith(
            expect.objectContaining({
                url: '/v1/accounts/ABC%2B123%2FDEF%3D456/transactions/',
            }),
        )
    })

    it('should not include undefined filter parameters', async () => {
        const mockResponse = {
            data: {
                results: [],
                next: null,
                previous: null,
            },
            status: 200,
            statusText: 'OK',
        }

        mockQueryClient.mockResolvedValue(mockResponse)

        await fetchTransactionHistory({
            accountAddress: 'ABC123DEF456',
            network: Networks.mainnet,
            assetId: undefined,
            afterTime: undefined,
            beforeTime: undefined,
        })

        const callParams = mockQueryClient.mock.calls[0][0].params

        // Should only have limit, not the undefined parameters
        expect(callParams).toEqual({
            limit: 25,
        })
    })
})

describe('fetchMoreTransactions', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('should extract path and search params from pagination URL', async () => {
        const mockResponse = {
            data: {
                results: [],
                next: null,
                previous: null,
            },
            status: 200,
            statusText: 'OK',
        }

        mockQueryClient.mockResolvedValue(mockResponse)

        await fetchMoreTransactions({
            url: 'https://api.perawallet.app/v1/accounts/ABC123/transactions/?cursor=abc&limit=25',
            network: Networks.mainnet,
        })

        expect(mockQueryClient).toHaveBeenCalledWith({
            backend: 'pera',
            network: Networks.mainnet,
            method: 'GET',
            url: '/v1/accounts/ABC123/transactions/?cursor=abc&limit=25',
            signal: undefined,
        })
    })

    it('should preserve query parameters from pagination URL including date filters', async () => {
        const mockResponse = {
            data: {
                results: [],
                next: null,
                previous: null,
            },
            status: 200,
            statusText: 'OK',
        }

        mockQueryClient.mockResolvedValue(mockResponse)

        await fetchMoreTransactions({
            url: 'https://api.perawallet.app/v1/accounts/ABC123/transactions/?after_time=2025-02-01&before_time=2025-02-13&cursor=xyz',
            network: Networks.testnet,
        })

        const call = mockQueryClient.mock.calls[0][0]

        // Should include the full path with query string
        expect(call.url).toContain('after_time=2025-02-01')
        expect(call.url).toContain('before_time=2025-02-13')
        expect(call.url).toContain('cursor=xyz')
    })
})

describe('routing by network', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    // Real indexer responses omit `next-token` entirely once pagination is
    // exhausted (verified against the live fnet indexer) rather than sending
    // `null` — the indexer envelope schema requires that key be a string or
    // absent.
    const indexerPage = {
        data: { 'current-round': 1, transactions: [] },
        status: 200,
        statusText: 'OK',
    }

    const peraPage = {
        data: { results: [], next: null, previous: null },
        status: 200,
        statusText: 'OK',
    }

    it('uses the pera backend on testnet', async () => {
        mockQueryClient.mockResolvedValue(peraPage)

        await fetchTransactionHistory({
            accountAddress: 'ABC123',
            network: Networks.testnet,
        })

        expect(mockQueryClient).toHaveBeenCalledWith(
            expect.objectContaining({ backend: 'pera' }),
        )
    })

    it('uses the real chain indexer on a fallback network', async () => {
        mockQueryClient.mockResolvedValue(indexerPage)

        await fetchTransactionHistory({
            accountAddress: 'ABC123',
            network: Networks.fnet,
        })

        expect(mockQueryClient).toHaveBeenCalledWith(
            expect.objectContaining({
                backend: 'indexer',
                network: Networks.fnet,
                url: '/v2/accounts/ABC123/transactions',
            }),
        )
    })

    it('does not change fetchMoreTransactions pera-backend behavior on mainnet', async () => {
        mockQueryClient.mockResolvedValue(peraPage)

        await fetchMoreTransactions({
            url: 'https://api.perawallet.app/v1/accounts/ABC123/transactions/?cursor=abc',
            network: Networks.mainnet,
        })

        expect(mockQueryClient).toHaveBeenCalledWith(
            expect.objectContaining({ backend: 'pera' }),
        )
    })

    it('fetchMoreTransactions sends the stored cursor as `next` on a fallback network', async () => {
        mockQueryClient.mockResolvedValue(indexerPage)

        await fetchMoreTransactions({
            url: 'CURSOR1',
            network: Networks.fnet,
            accountAddress: 'ABC123',
        })

        expect(mockQueryClient).toHaveBeenCalledWith(
            expect.objectContaining({
                backend: 'indexer',
                network: Networks.fnet,
                url: '/v2/accounts/ABC123/transactions',
                params: expect.objectContaining({ next: 'CURSOR1' }),
            }),
        )
    })

    it('fetchMoreTransactions rejects on a fallback network without accountAddress', async () => {
        await expect(
            fetchMoreTransactions({
                url: 'CURSOR1',
                network: Networks.fnet,
            }),
        ).rejects.toThrow(/accountAddress/)

        expect(mockQueryClient).not.toHaveBeenCalled()
    })
})

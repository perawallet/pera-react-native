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

import { describe, test, expect, vi, beforeEach } from 'vitest'

const queryClientMock = vi.hoisted(() => vi.fn())

vi.mock('@perawallet/wallet-core-shared', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@perawallet/wallet-core-shared')>()
    return {
        ...actual,
        queryClient: queryClientMock,
    }
})

import {
    fetchAssets,
    fetchAccountAssets,
    fetchAssetDetails,
    fetchPublicAssetDetails,
    fetchIndexerAssetDetails,
} from '../endpoints'
import { searchAssets } from '../search-endpoints'

const validAsset = {
    asset_id: 123,
    name: 'Test',
    logo: null,
    unit_name: 'TST',
    fraction_decimals: 6,
    total: '1000000',
    usd_value: null,
    verification_tier: 'trusted',
    is_verified: true,
    is_deleted: false,
    category: null,
    creator: { address: 'CREATOR' },
    type: 'standard_asset' as const,
}

const validAssetsResponse = {
    results: [validAsset],
    next: null,
    previous: null,
}

describe('assets endpoints', () => {
    beforeEach(() => {
        queryClientMock.mockReset()
    })

    test('fetchAssets calls /v1/assets/ with comma-joined asset_ids and include_deleted', async () => {
        queryClientMock.mockResolvedValue({ data: validAssetsResponse })

        await fetchAssets(['1', '2', '3'], 'mainnet')

        expect(queryClientMock).toHaveBeenCalledWith(
            expect.objectContaining({
                url: '/v1/assets/',
                params: { asset_ids: '1,2,3', include_deleted: true },
            }),
        )
    })

    test('fetchAccountAssets calls /v2/accounts/:address/assets/', async () => {
        queryClientMock.mockResolvedValue({ data: validAssetsResponse })

        await fetchAccountAssets('ADDR', 'testnet')

        expect(queryClientMock).toHaveBeenCalledWith(
            expect.objectContaining({
                url: '/v2/accounts/ADDR/assets/',
                network: 'testnet',
            }),
        )
    })

    test('fetchAssetDetails calls /v1/assets/:id', async () => {
        queryClientMock.mockResolvedValue({ data: validAsset })

        await fetchAssetDetails('123', 'mainnet')

        expect(queryClientMock).toHaveBeenCalledWith(
            expect.objectContaining({
                url: '/v1/assets/123',
            }),
        )
    })

    test('fetchPublicAssetDetails calls /v1/public/assets/:id', async () => {
        queryClientMock.mockResolvedValue({
            data: {
                asset_id: 123,
                name: 'Test',
                unit_name: 'TST',
                fraction_decimals: 6,
                total_supply: 1000000,
                total_supply_as_str: '1000000',
                verification_tier: 'trusted',
                is_collectible: false,
            },
        })

        await fetchPublicAssetDetails('123', 'mainnet')

        expect(queryClientMock).toHaveBeenCalledWith(
            expect.objectContaining({
                url: '/v1/public/assets/123',
            }),
        )
    })

    test('fetchIndexerAssetDetails hits the indexer backend', async () => {
        queryClientMock.mockResolvedValue({
            data: {
                asset: {
                    index: 123,
                    params: {
                        creator: 'CREATOR',
                        decimals: 6,
                        'default-frozen': false,
                        name: 'Test',
                        'unit-name': 'TST',
                        total: 1000,
                    },
                },
                'current-round': 42,
            },
        })

        await fetchIndexerAssetDetails('123', 'mainnet')

        expect(queryClientMock).toHaveBeenCalledWith(
            expect.objectContaining({
                backend: 'indexer',
                url: '/v2/assets/123',
            }),
        )
    })

    test('fetchAssets throws when response fails schema validation', async () => {
        queryClientMock.mockResolvedValue({ data: { results: 'not-array' } })

        await expect(fetchAssets(['1'], 'mainnet')).rejects.toThrow()
    })
})

describe('searchAssets', () => {
    beforeEach(() => {
        queryClientMock.mockReset()
    })

    const validSearchResponse = {
        results: [],
        next: null,
        previous: null,
    }

    test('uses default limit from DEFAULT_PAGE_SIZE and passes the query', async () => {
        queryClientMock.mockResolvedValue({ data: validSearchResponse })

        await searchAssets({ query: 'usdc', network: 'mainnet' })

        expect(queryClientMock).toHaveBeenCalledWith(
            expect.objectContaining({
                url: '/v1/assets/search/',
                params: expect.objectContaining({ q: 'usdc' }),
            }),
        )
    })

    test('forwards cursor and has_collectible when provided', async () => {
        queryClientMock.mockResolvedValue({ data: validSearchResponse })

        await searchAssets({
            query: 'art',
            network: 'mainnet',
            cursor: 'abc',
            hasCollectible: true,
            limit: 25,
        })

        expect(queryClientMock).toHaveBeenCalledWith(
            expect.objectContaining({
                params: {
                    q: 'art',
                    limit: 25,
                    cursor: 'abc',
                    has_collectible: 'true',
                },
            }),
        )
    })

    test('omits cursor and has_collectible when not provided', async () => {
        queryClientMock.mockResolvedValue({ data: validSearchResponse })

        await searchAssets({ query: 'x', network: 'mainnet' })

        const call = queryClientMock.mock.calls[0][0]
        expect(call.params).not.toHaveProperty('cursor')
        expect(call.params).not.toHaveProperty('has_collectible')
    })

    test('omits q when query is empty so the backend returns suggestions', async () => {
        queryClientMock.mockResolvedValue({ data: validSearchResponse })

        await searchAssets({ query: '', network: 'mainnet' })

        const call = queryClientMock.mock.calls[0][0]
        expect(call.params).not.toHaveProperty('q')
    })
})

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

import { describe, test, expect, vi, beforeEach } from 'vitest'

const queryClientMock = vi.hoisted(() => vi.fn())
const fetchNodeJsonMock = vi.hoisted(() => vi.fn())

vi.mock('../../../blockchain/utils/nodeHttp', () => ({
    fetchNodeJson: fetchNodeJsonMock,
}))

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
    fetchCrossChainAssetGroups,
    fetchAssetDetails,
    fetchPublicAssetDetails,
    fetchIndexerAssetDetails,
} from '../endpoints'
import { searchAssets } from '../search-endpoints'
import { LEGACY_CHAIN_ID } from '@perawallet/wallet-core-chain-contract'

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

    describe('fetchCrossChainAssetGroups', () => {
        const MAINNET = 'algorand:wGHE2Pwdvd7S12BL5FaOP20EGYesN73k'
        const USDC_GROUP = { id: 'usdc', name: 'USD Coin', symbol: 'USDC' }

        test("posts each id as the network's CAIP-19 and answers each group by ASA id", async () => {
            queryClientMock.mockResolvedValue({
                data: {
                    results: [
                        {
                            asset_id: `${MAINNET}/asa:31566704`,
                            cross_chain_asset_group: USDC_GROUP,
                            name: 'USDC',
                        },
                        {
                            asset_id: `${MAINNET}/asa:7`,
                            cross_chain_asset_group: null,
                        },
                    ],
                },
            })

            const groups = await fetchCrossChainAssetGroups(
                ['31566704', '7'],
                'mainnet',
            )

            expect(queryClientMock).toHaveBeenCalledWith(
                expect.objectContaining({
                    method: 'POST',
                    url: '/api/v4/assets/',
                    data: {
                        ids: [`${MAINNET}/asa:31566704`, `${MAINNET}/asa:7`],
                    },
                }),
            )
            expect(groups).toEqual(
                new Map([
                    ['31566704', USDC_GROUP],
                    ['7', null],
                ]),
            )
        })

        test('leaves out an id the answer omits and ignores one it was not asked for', async () => {
            queryClientMock.mockResolvedValue({
                data: {
                    results: [
                        {
                            asset_id: `${MAINNET}/asa:99`,
                            cross_chain_asset_group: USDC_GROUP,
                        },
                        {
                            asset_id: `${MAINNET}/asa:7`,
                            cross_chain_asset_group: null,
                        },
                    ],
                },
            })

            const groups = await fetchCrossChainAssetGroups(
                ['31566704', '7'],
                'mainnet',
            )

            expect(groups).toEqual(new Map([['7', null]]))
        })
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

    test('fetchAssets uses POST /v2/assets/ with device_id when a deviceId is provided', async () => {
        queryClientMock.mockResolvedValue({ data: validAssetsResponse })

        await fetchAssets(['1', '2', '3'], 'mainnet', '98765')

        expect(queryClientMock).toHaveBeenCalledWith(
            expect.objectContaining({
                backend: 'pera',
                scope: {
                    chainId: LEGACY_CHAIN_ID,
                    networkId: 'mainnet',
                } as const,
                method: 'POST',
                url: '/v2/assets/',
                body: '{"device_id":98765,"asset_ids":["1","2","3"],"include_deleted":true}',
            }),
        )
    })

    test('fetchAssets falls back to GET /v1/assets/ when deviceId is null', async () => {
        queryClientMock.mockResolvedValue({ data: validAssetsResponse })

        await fetchAssets(['1', '2'], 'mainnet', null)

        expect(queryClientMock).toHaveBeenCalledWith(
            expect.objectContaining({
                method: 'GET',
                url: '/v1/assets/',
            }),
        )
    })

    test('fetchAssetDetails calls /v1/assets/:id', async () => {
        queryClientMock.mockResolvedValue({ data: validAsset })

        await fetchAssetDetails('123', 'mainnet')

        expect(queryClientMock).toHaveBeenCalledWith(
            expect.objectContaining({
                url: '/v1/assets/123/',
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
                url: '/v1/public/assets/123/',
            }),
        )
    })

    test('fetchIndexerAssetDetails hits the indexer backend', async () => {
        fetchNodeJsonMock.mockResolvedValue({
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
        })

        await fetchIndexerAssetDetails('123', 'mainnet')

        expect(fetchNodeJsonMock).toHaveBeenCalledWith(
            'mainnet',
            'indexer',
            '/v2/assets/123',
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

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
    fetchAssetItems,
    fetchCrossChainAssetGroups,
    fetchAssetDetails,
    fetchPublicAssetDetails,
    fetchIndexerAssetDetails,
} from '../endpoints'
import { searchAssets } from '../search-endpoints'
import { LEGACY_CHAIN_ID } from '@perawallet/wallet-core-chain-contract'
import {
    logger,
    PeraServiceUnavailableError,
} from '@perawallet/wallet-core-shared'

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

    describe('fetchAssetItems', () => {
        const MAINNET = 'algorand:wGHE2Pwdvd7S12BL5FaOP20EGYesN73k'
        const v4Item = (assetId: string) => ({
            asset_id: `${MAINNET}/asa:${assetId}`,
            type: 'standard_asset',
            name: 'Test',
            unit_name: 'TST',
            fraction_decimals: 6,
            logo: null,
            usd_value: null,
            is_verified: true,
            verification_tier: 'verified',
            explorer_url: null,
            total: '1000000',
            is_deleted: false,
            creator: {
                id: '9007199254740993',
                address: 'CREATOR',
                is_verified_asset_creator: false,
            },
            collectible: null,
            category: null,
            labels: [],
            is_favorited: true,
            is_price_alert_enabled: false,
            cross_chain_asset_group: null,
        })
        const requestBody = () => queryClientMock.mock.lastCall?.[0].data

        test("posts each id as the network's CAIP-19 in order, with integrity headers", async () => {
            queryClientMock.mockResolvedValue({ data: { results: [] } })

            await fetchAssetItems(['31566704', '7'], 'mainnet')

            expect(queryClientMock).toHaveBeenCalledTimes(1)
            expect(queryClientMock).toHaveBeenCalledWith(
                expect.objectContaining({
                    backend: 'pera',
                    method: 'POST',
                    url: '/api/v4/assets/',
                    headers: expect.any(Object),
                }),
            )
            expect(requestBody()).toEqual({
                ids: [`${MAINNET}/asa:31566704`, `${MAINNET}/asa:7`],
            })
        })

        test('sends the device id as the exact decimal string', async () => {
            queryClientMock.mockResolvedValue({ data: { results: [] } })

            await fetchAssetItems(['7'], 'mainnet', '4567123498765432101')

            const body = JSON.parse(JSON.stringify(requestBody()))
            expect(typeof body.device_id).toBe('string')
            expect(body.device_id).toBe('4567123498765432101')
        })

        test('sends ALGO as asa:0', async () => {
            queryClientMock.mockResolvedValue({ data: { results: [] } })

            await fetchAssetItems(['0'], 'mainnet')

            expect(requestBody()).toEqual({ ids: [`${MAINNET}/asa:0`] })
        })

        test('answers each item by ASA id, dropping an unreadable row and one it did not ask for', async () => {
            queryClientMock.mockResolvedValue({
                data: {
                    results: [
                        v4Item('31566704'),
                        { ...v4Item('7'), total: 12 },
                        v4Item('99'),
                    ],
                },
            })

            const items = await fetchAssetItems(['31566704', '7'], 'mainnet')

            expect([...items.keys()]).toEqual(['31566704'])
            expect(items.get('31566704')).toMatchObject({
                total: '1000000',
                creator: { address: 'CREATOR' },
                is_favorited: true,
            })
        })

        test('warns once per batch, naming the first unreadable row', async () => {
            const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {})
            queryClientMock.mockResolvedValue({
                data: {
                    results: [
                        { ...v4Item('7'), total: 12 },
                        { ...v4Item('8'), labels: undefined },
                        v4Item('99'),
                    ],
                },
            })

            await fetchAssetItems(['7', '8'], 'mainnet')

            expect(warn).toHaveBeenCalledTimes(1)
            expect(warn).toHaveBeenCalledWith(
                'Unreadable v4 asset items dropped',
                expect.objectContaining({
                    network: 'mainnet',
                    dropped: 2,
                    of: 3,
                    first: expect.objectContaining({
                        assetId: `${MAINNET}/asa:7`,
                    }),
                }),
            )
            warn.mockRestore()
        })

        test('stays quiet when every row is readable', async () => {
            const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {})
            queryClientMock.mockResolvedValue({
                data: { results: [v4Item('7')] },
            })

            await fetchAssetItems(['7'], 'mainnet')

            expect(warn).not.toHaveBeenCalled()
            warn.mockRestore()
        })

        test('makes no request for no ids', async () => {
            const items = await fetchAssetItems([], 'mainnet')

            expect(items.size).toBe(0)
            expect(queryClientMock).not.toHaveBeenCalled()
        })

        test('refuses a network with no CAIP-2 id before any request', async () => {
            await expect(
                fetchAssetItems(['7'], 'custom'),
            ).rejects.toBeInstanceOf(PeraServiceUnavailableError)
            expect(queryClientMock).not.toHaveBeenCalled()
        })

        test('rejects when the backend does not know the device', async () => {
            queryClientMock.mockRejectedValue(new Error('device_not_found'))

            await expect(
                fetchAssetItems(['7'], 'mainnet', '1'),
            ).rejects.toThrow('device_not_found')
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

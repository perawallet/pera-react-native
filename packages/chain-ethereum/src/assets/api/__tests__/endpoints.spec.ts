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

import {
    afterAll,
    afterEach,
    beforeAll,
    describe,
    expect,
    it,
    vi,
} from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import {
    isPeraServiceUnavailableError,
    logger,
    PeraNetworkError,
} from '@perawallet/wallet-core-shared'
import {
    fetchAssetItems,
    fetchNftHoldings,
    NFT_LISTING_REUSE_MS,
    fetchNftItems,
    fetchWhitelist,
    NFT_HOLDINGS_MAX_PAGES,
    nftCursorOf,
} from '../endpoints'
import { isDescribedNftItem } from '../transformers'
import {
    evmNftItem,
    nativeWhitelistItem,
    peraEvmAssetHandlers,
    unknownAssetItem,
} from '../msw-handlers'
import type { AssetItemResponse, WhitelistItemResponse } from '../schema'
import {
    PERA_URL,
    TEST_API_KEY,
    TEST_INTEGRITY_TOKEN,
} from '../../../__tests__/pera-backend'
import { ETHEREUM } from '../../../__tests__/evm-chains'

vi.mock('@perawallet/wallet-core-config', async importOriginal =>
    (await import('../../../__tests__/pera-backend')).withEthereumPeraBackend(
        importOriginal,
        ['nfts'],
    ),
)

const SCOPE: ChainScope = { chainId: 'ethereum', networkId: 'mainnet' }
const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
const DAI = '0x6B175474E89094C44Da98b954EedeAC495271d0F'
const USDC_CAIP19 = `eip155:1/erc20:${USDC.toLowerCase()}`
const DAI_CAIP19 = `eip155:1/erc20:${DAI.toLowerCase()}`
const usdc: AssetItemResponse = {
    asset_id: USDC_CAIP19,
    type: 'erc20',
    name: 'USD Coin',
    unit_name: 'USDC',
    fraction_decimals: 6,
    logo: 'https://pera.test/usdc.png',
    usd_value: '1.000000000000000000000000',
    last_24_hours_usd_price_change_percentage: 0.01,
    is_verified: true,
    verification_tier: 'verified',
    explorer_url: null,
}
const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('fetchAssetItems', () => {
    it('posts CAIP-19 ids with the API key and integrity token, and returns the items', async () => {
        let body: unknown
        let headers: Headers | undefined
        server.use(
            http.post(`${PERA_URL}/api/v4/assets/`, async ({ request }) => {
                body = await request.json()
                headers = request.headers
                return HttpResponse.json({ results: [usdc] })
            }),
        )

        const items = await fetchAssetItems(SCOPE, ETHEREUM, [USDC])

        expect(body).toEqual({ ids: [USDC_CAIP19] })
        expect(headers?.get('x-api-key')).toBe(TEST_API_KEY)
        expect(headers?.get('x-app-integrity-token')).toBe(TEST_INTEGRITY_TOKEN)
        expect(items).toEqual([usdc])
    })

    it('rejects a response that does not answer the request in order', async () => {
        server.use(
            http.post(`${PERA_URL}/api/v4/assets/`, () =>
                HttpResponse.json({ results: [usdc] }),
            ),
        )

        await expect(fetchAssetItems(SCOPE, ETHEREUM, [DAI])).rejects.toThrow()
        await expect(
            fetchAssetItems(SCOPE, ETHEREUM, [USDC, DAI]),
        ).rejects.toThrow()
    })

    it('accepts the lowercase ids the backend answers with', async () => {
        server.use(
            http.post(`${PERA_URL}/api/v4/assets/`, () =>
                HttpResponse.json({
                    results: [unknownAssetItem(DAI_CAIP19), usdc],
                }),
            ),
        )

        const items = await fetchAssetItems(SCOPE, ETHEREUM, [DAI, USDC])

        expect(items.map(item => item?.asset_id)).toEqual([
            DAI_CAIP19,
            USDC_CAIP19,
        ])
    })

    it('makes no request for an empty list', async () => {
        await expect(fetchAssetItems(SCOPE, ETHEREUM, [])).resolves.toEqual([])
    })

    it('rejects with a PeraNetworkError on a non-2xx answer', async () => {
        server.use(
            http.post(`${PERA_URL}/api/v4/assets/`, () =>
                HttpResponse.json({ detail: 'bad' }, { status: 400 }),
            ),
        )

        await expect(
            fetchAssetItems(SCOPE, ETHEREUM, [USDC]),
        ).rejects.toBeInstanceOf(PeraNetworkError)
    })

    it('answers null for a row it cannot read, logs it and keeps the rest', async () => {
        const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {})
        server.use(
            http.post(`${PERA_URL}/api/v4/assets/`, () =>
                HttpResponse.json({
                    results: [
                        {
                            ...unknownAssetItem(DAI_CAIP19),
                            verification_tier: 'trusted',
                        },
                        usdc,
                    ],
                }),
            ),
        )

        const items = await fetchAssetItems(SCOPE, ETHEREUM, [DAI, USDC])

        expect(items).toEqual([null, usdc])
        expect(warn).toHaveBeenCalledTimes(1)
        expect(warn).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({
                count: 1,
                assetIds: [DAI_CAIP19],
                fields: ['verification_tier'],
            }),
        )
        warn.mockRestore()
    })

    it.each([
        ['a price at another precision', { usd_value: '1.5' }],
        [
            'a price change of another type',
            { last_24_hours_usd_price_change_percentage: '0.1' },
        ],
    ])('keeps the logo and name of a row with %s', async (_name, price) => {
        server.use(
            http.post(`${PERA_URL}/api/v4/assets/`, () =>
                HttpResponse.json({ results: [{ ...usdc, ...price }] }),
            ),
        )

        const [item] = await fetchAssetItems(SCOPE, ETHEREUM, [USDC])

        expect(item).toEqual({
            ...usdc,
            ...Object.fromEntries(Object.keys(price).map(key => [key, null])),
        })
    })

    it('rejects a row with no asset_id, since its position cannot be checked', async () => {
        server.use(
            http.post(`${PERA_URL}/api/v4/assets/`, () =>
                HttpResponse.json({ results: [{ name: 'USD Coin' }] }),
            ),
        )

        await expect(fetchAssetItems(SCOPE, ETHEREUM, [USDC])).rejects.toThrow()
    })
})

describe('fetchWhitelist', () => {
    const usdcRow: WhitelistItemResponse = {
        ...usdc,
        is_swappable: true,
        is_fundable: false,
    }

    it("reads the scope chain's list by its EIP-155 id", async () => {
        const chainIds: string[] = []
        server.use(
            http.get(
                `${PERA_URL}/api/v3/evm/:chainId/tokens/`,
                ({ params }) => {
                    chainIds.push(String(params.chainId))
                    return HttpResponse.json({
                        results: [nativeWhitelistItem(1), usdcRow],
                    })
                },
            ),
        )

        const rows = await fetchWhitelist(SCOPE, ETHEREUM)

        expect(chainIds).toEqual(['1'])
        expect(rows.map(({ assetId, type }) => ({ assetId, type }))).toEqual([
            { assetId: 'native', type: 'native' },
            { assetId: USDC, type: 'erc20' },
        ])
    })

    it('carries each row as a search result shows it', async () => {
        server.use(
            http.get(`${PERA_URL}/api/v3/evm/:chainId/tokens/`, () =>
                HttpResponse.json({ results: [usdcRow] }),
            ),
        )

        const [row] = await fetchWhitelist(SCOPE, ETHEREUM)

        expect(row?.asset).toEqual({
            assetId: USDC,
            name: 'USD Coin',
            unitName: 'USDC',
            decimals: 6,
            peraMetadata: {
                logo: 'https://pera.test/usdc.png',
                verificationTier: 'verified',
                type: 'standard_asset',
            },
        })
    })

    it('skips a row it cannot use and keeps the rest', async () => {
        server.use(
            http.get(`${PERA_URL}/api/v3/evm/:chainId/tokens/`, () =>
                HttpResponse.json({
                    results: [
                        nativeWhitelistItem(1),
                        // Without the listing flags.
                        usdc,
                        {
                            ...usdcRow,
                            asset_id: `eip155:1/erc721:${DAI.toLowerCase()}`,
                            type: 'erc721',
                        },
                        { ...usdcRow, asset_id: `eip155:10/erc20:${DAI}` },
                        { ...usdcRow, verification_tier: 'trusted' },
                        { ...usdcRow, is_verified: 'yes' },
                        { ...usdcRow, asset_id: DAI_CAIP19, type: 'algo' },
                        usdcRow,
                    ],
                }),
            ),
        )

        const rows = await fetchWhitelist(SCOPE, ETHEREUM)

        expect(rows.map(({ assetId, type }) => ({ assetId, type }))).toEqual([
            { assetId: 'native', type: 'native' },
            { assetId: USDC, type: 'erc20' },
        ])
    })

    it('rejects a response whose results is not a list', async () => {
        server.use(
            http.get(`${PERA_URL}/api/v3/evm/:chainId/tokens/`, () =>
                HttpResponse.json({ results: { 0: usdcRow } }),
            ),
        )

        await expect(fetchWhitelist(SCOPE, ETHEREUM)).rejects.toThrow()
    })

    it('rejects with a PeraNetworkError on a non-2xx answer', async () => {
        server.use(
            http.get(`${PERA_URL}/api/v3/evm/:chainId/tokens/`, () =>
                HttpResponse.json({}, { status: 422 }),
            ),
        )

        await expect(fetchWhitelist(SCOPE, ETHEREUM)).rejects.toBeInstanceOf(
            PeraNetworkError,
        )
    })
})

const HOLDER = '0x5AAeb6053F3E94C9b9A09f33669435E7Ef1BeAed'
const BAYC = '0xbc4ca0eda7647a8ab7c2061c2e118a18a936f13d'
const ape = (tokenId: string) =>
    evmNftItem({ asset_id: `eip155:1/erc721:${BAYC}/${tokenId}` })

describe('fetchNftHoldings', () => {
    it('reads every page, passing the cursor, with the API key and integrity token', async () => {
        const cursors: (string | null)[] = []
        let headers: Headers | undefined
        server.events.on('request:start', ({ request }) => {
            cursors.push(new URL(request.url).searchParams.get('cursor'))
            headers = request.headers
        })
        server.use(
            ...peraEvmAssetHandlers({
                baseUrl: PERA_URL,
                nftHoldings: {
                    [HOLDER.toLowerCase()]: [[ape('1'), ape('2')], [ape('3')]],
                },
            }),
        )

        const { items } = await fetchNftHoldings(SCOPE, ETHEREUM, HOLDER)
        server.events.removeAllListeners()

        expect(items.map(item => item.asset_id)).toEqual([
            `eip155:1/erc721:${BAYC}/1`,
            `eip155:1/erc721:${BAYC}/2`,
            `eip155:1/erc721:${BAYC}/3`,
        ])
        expect(cursors).toEqual([null, 'page:1'])
        expect(headers?.get('x-api-key')).toBe(TEST_API_KEY)
        expect(headers?.get('x-app-integrity-token')).toBe(TEST_INTEGRITY_TOKEN)
    })

    it('asks for the lowercase address and skips a row it cannot read', async () => {
        let path = ''
        server.use(
            http.get(
                `${PERA_URL}/api/v3/evm/1/accounts/:address/nfts/`,
                ({ request }) => {
                    path = new URL(request.url).pathname
                    return HttpResponse.json({
                        next: null,
                        results: [{ asset_id: 'broken' }, ape('1')],
                    })
                },
            ),
        )

        const { items } = await fetchNftHoldings(SCOPE, ETHEREUM, HOLDER)

        expect(path).toBe(
            `/api/v3/evm/1/accounts/${HOLDER.toLowerCase()}/nfts/`,
        )
        expect(items).toHaveLength(1)
    })

    it('keeps paging past an empty page that names a next one', async () => {
        server.use(
            ...peraEvmAssetHandlers({
                baseUrl: PERA_URL,
                nftHoldings: { [HOLDER.toLowerCase()]: [[], [ape('7')]] },
            }),
        )

        const { items } = await fetchNftHoldings(SCOPE, ETHEREUM, HOLDER)

        expect(items.map(item => item.asset_id)).toEqual([
            `eip155:1/erc721:${BAYC}/7`,
        ])
    })

    it.each([
        [502, undefined],
        [503, 'upstream_unavailable'],
        [429, 'upstream_rate_limited'],
    ])('rejects on a %s', async (status, backendCode) => {
        server.use(
            ...peraEvmAssetHandlers({ baseUrl: PERA_URL, nftHoldings: status }),
        )

        const error = await fetchNftHoldings(SCOPE, ETHEREUM, HOLDER).catch(
            (reason: unknown) => reason,
        )

        expect(error).toBeInstanceOf(PeraNetworkError)
        expect((error as PeraNetworkError).backendCode).toBe(backendCode)
    })

    it('reads a 422 nft_not_supported as a scope without the nfts service', async () => {
        server.use(
            ...peraEvmAssetHandlers({ baseUrl: PERA_URL, nftHoldings: 422 }),
        )

        const error = await fetchNftHoldings(SCOPE, ETHEREUM, HOLDER).catch(
            (reason: unknown) => reason,
        )

        expect(isPeraServiceUnavailableError(error)).toBe(true)
    })

    it('rejects a cursor that never ends', async () => {
        let requests = 0
        server.use(
            http.get(`${PERA_URL}/api/v3/evm/1/accounts/:address/nfts/`, () => {
                requests++
                return HttpResponse.json({
                    next: `${PERA_URL}/api/v3/evm/1/accounts/x/nfts/?cursor=again`,
                    results: [],
                })
            }),
        )

        await expect(
            fetchNftHoldings(SCOPE, ETHEREUM, HOLDER),
        ).rejects.toThrow()
        expect(requests).toBe(NFT_HOLDINGS_MAX_PAGES)
    })

    it('rejects a next that is not a URL with a cursor', async () => {
        server.use(
            http.get(`${PERA_URL}/api/v3/evm/1/accounts/:address/nfts/`, () =>
                HttpResponse.json({ next: 'page:1', results: [] }),
            ),
        )

        await expect(
            fetchNftHoldings(SCOPE, ETHEREUM, HOLDER),
        ).rejects.toThrow()
    })
    it('asks page one, and only it, to skip the cache on a forced refresh', async () => {
        const queries: string[] = []
        server.events.on('request:start', ({ request }) => {
            queries.push(new URL(request.url).search)
        })
        server.use(
            ...peraEvmAssetHandlers({
                baseUrl: PERA_URL,
                nftHoldings: {
                    [HOLDER.toLowerCase()]: [[ape('1')], [ape('2')]],
                },
            }),
        )

        await fetchNftHoldings(SCOPE, ETHEREUM, HOLDER, { forceRefresh: true })
        server.events.removeAllListeners()

        expect(queries).toEqual(['?force_refresh=true', '?cursor=page%3A1'])
    })

    it('answers the prior list from page one alone while page one is unchanged', async () => {
        const cursors: (string | null)[] = []
        server.events.on('request:start', ({ request }) => {
            cursors.push(new URL(request.url).searchParams.get('cursor'))
        })
        server.use(
            ...peraEvmAssetHandlers({
                baseUrl: PERA_URL,
                nftHoldings: {
                    [HOLDER.toLowerCase()]: [[ape('1')], [ape('2')]],
                },
            }),
        )
        const prior = await fetchNftHoldings(SCOPE, ETHEREUM, HOLDER, {
            now: () => 0,
        })
        cursors.length = 0

        const again = await fetchNftHoldings(SCOPE, ETHEREUM, HOLDER, {
            prior,
            now: () => NFT_LISTING_REUSE_MS - 1,
        })
        server.events.removeAllListeners()

        expect(again).toBe(prior)
        expect(cursors).toEqual([null])
    })

    it('reads every page again once the prior list is a rate-limit window old', async () => {
        server.use(
            ...peraEvmAssetHandlers({
                baseUrl: PERA_URL,
                nftHoldings: {
                    [HOLDER.toLowerCase()]: [[ape('1')], [ape('2')]],
                },
            }),
        )
        const prior = await fetchNftHoldings(SCOPE, ETHEREUM, HOLDER, {
            now: () => 0,
        })
        const cursors: (string | null)[] = []
        server.events.on('request:start', ({ request }) => {
            cursors.push(new URL(request.url).searchParams.get('cursor'))
        })

        const again = await fetchNftHoldings(SCOPE, ETHEREUM, HOLDER, {
            prior,
            now: () => NFT_LISTING_REUSE_MS,
        })
        server.events.removeAllListeners()

        expect(cursors).toEqual([null, 'page:1'])
        expect(again).not.toBe(prior)
        expect(again.readAt).toBe(NFT_LISTING_REUSE_MS)
    })

    it.each([
        [
            'page one changed',
            { [HOLDER.toLowerCase()]: [[ape('9')], [ape('2')]] },
            false,
        ],
        [
            'the refresh is forced',
            { [HOLDER.toLowerCase()]: [[ape('1')], [ape('2')]] },
            true,
        ],
    ])(
        'reads every page again when %s',
        async (_, nftHoldings, forceRefresh) => {
            server.use(
                ...peraEvmAssetHandlers({
                    baseUrl: PERA_URL,
                    nftHoldings: {
                        [HOLDER.toLowerCase()]: [[ape('1')], [ape('2')]],
                    },
                }),
            )
            const prior = await fetchNftHoldings(SCOPE, ETHEREUM, HOLDER)
            const cursors: (string | null)[] = []
            server.events.on('request:start', ({ request }) => {
                cursors.push(new URL(request.url).searchParams.get('cursor'))
            })
            server.use(
                ...peraEvmAssetHandlers({ baseUrl: PERA_URL, nftHoldings }),
            )

            const again = await fetchNftHoldings(SCOPE, ETHEREUM, HOLDER, {
                prior,
                forceRefresh,
            })
            server.events.removeAllListeners()

            expect(cursors).toEqual([null, 'page:1'])
            expect(again).not.toBe(prior)
        },
    )
})

describe('nftCursorOf', () => {
    it('reads the cursor from a full next URL', () => {
        expect(
            nftCursorOf(
                'https://pera.test/api/v3/evm/1/accounts/x/nfts/?cursor=abc%3D',
            ),
        ).toBe('abc=')
    })

    it.each([
        'page:1',
        'https://pera.test/nfts/',
        'https://pera.test/?cursor=',
    ])('throws on %s', next => {
        expect(() => nftCursorOf(next)).toThrow()
    })
})

describe('fetchNftItems', () => {
    const known = `eip155:1/erc721:${BAYC}/1`
    const unknown = `eip155:1/erc1155:${BAYC}/1`

    it('answers in request order, a blank item for an unknown id', async () => {
        server.use(
            ...peraEvmAssetHandlers({
                baseUrl: PERA_URL,
                nfts: { [known]: ape('1') },
            }),
        )

        const items = await fetchNftItems(SCOPE, ETHEREUM, [unknown, known])

        expect(items[0]).toMatchObject({
            asset_id: unknown,
            name: null,
            primary_image: null,
            media: [],
            traits: [],
        })
        expect(items[0] !== null && isDescribedNftItem(items[0])).toBe(false)
        expect(items[1]?.asset_id).toBe(known)
    })

    it('parses a null balance and a described item with live-shaped traits and media', async () => {
        server.use(
            ...peraEvmAssetHandlers({
                baseUrl: PERA_URL,
                nfts: { [known]: ape('1') },
            }),
        )

        const [item] = await fetchNftItems(SCOPE, ETHEREUM, [known])

        expect(item?.balance).toBeNull()
        expect(item?.traits).toEqual([
            { trait_type: 'Background', value: 'Orange' },
        ])
        expect(item?.media).toHaveLength(1)
    })

    it.each([
        [503, 'upstream_unavailable'],
        [429, 'upstream_rate_limited'],
    ])('rejects with the backend code on a %s', async (status, backendCode) => {
        server.use(...peraEvmAssetHandlers({ baseUrl: PERA_URL, nfts: status }))

        const error = await fetchNftItems(SCOPE, ETHEREUM, [known]).catch(
            (reason: unknown) => reason,
        )

        expect(error).toBeInstanceOf(PeraNetworkError)
        expect((error as PeraNetworkError).backendCode).toBe(backendCode)
    })

    it('rejects a misaligned answer', async () => {
        server.use(
            http.post(`${PERA_URL}/api/v4/nfts/`, () =>
                HttpResponse.json({ results: [ape('2')] }),
            ),
        )

        await expect(fetchNftItems(SCOPE, ETHEREUM, [known])).rejects.toThrow()
        await expect(
            fetchNftItems(SCOPE, ETHEREUM, [known, unknown]),
        ).rejects.toThrow()
    })

    it('makes no request for no ids', async () => {
        await expect(fetchNftItems(SCOPE, ETHEREUM, [])).resolves.toEqual([])
    })
})

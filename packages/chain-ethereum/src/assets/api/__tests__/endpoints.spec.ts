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
import { PeraNetworkError } from '@perawallet/wallet-core-shared'
import { fetchAssetItems, fetchWhitelist } from '../endpoints'
import { nativeWhitelistItem, unknownAssetItem } from '../msw-handlers'
import type { AssetItemResponse, WhitelistItemResponse } from '../schema'
import {
    PERA_URL,
    TEST_API_KEY,
    TEST_INTEGRITY_TOKEN,
} from '../../../__tests__/pera-backend'

vi.mock('@perawallet/wallet-core-config', async importOriginal =>
    (await import('../../../__tests__/pera-backend')).withEthereumPeraBackend(
        importOriginal,
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

        const items = await fetchAssetItems(SCOPE, [USDC])

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

        await expect(fetchAssetItems(SCOPE, [DAI])).rejects.toThrow()
        await expect(fetchAssetItems(SCOPE, [USDC, DAI])).rejects.toThrow()
    })

    it('accepts the lowercase ids the backend answers with', async () => {
        server.use(
            http.post(`${PERA_URL}/api/v4/assets/`, () =>
                HttpResponse.json({
                    results: [unknownAssetItem(DAI_CAIP19), usdc],
                }),
            ),
        )

        const items = await fetchAssetItems(SCOPE, [DAI, USDC])

        expect(items.map(item => item.asset_id)).toEqual([
            DAI_CAIP19,
            USDC_CAIP19,
        ])
    })

    it('makes no request for an empty list', async () => {
        await expect(fetchAssetItems(SCOPE, [])).resolves.toEqual([])
    })

    it('rejects with a PeraNetworkError on a non-2xx answer', async () => {
        server.use(
            http.post(`${PERA_URL}/api/v4/assets/`, () =>
                HttpResponse.json({ detail: 'bad' }, { status: 400 }),
            ),
        )

        await expect(fetchAssetItems(SCOPE, [USDC])).rejects.toBeInstanceOf(
            PeraNetworkError,
        )
    })

    it('rejects a usd_value that is not a 24-place decimal string', async () => {
        server.use(
            http.post(`${PERA_URL}/api/v4/assets/`, () =>
                HttpResponse.json({ results: [{ ...usdc, usd_value: '1.5' }] }),
            ),
        )

        await expect(fetchAssetItems(SCOPE, [USDC])).rejects.toThrow()
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

        const rows = await fetchWhitelist(SCOPE)

        expect(chainIds).toEqual(['1'])
        expect(rows).toEqual([
            { assetId: 'native', type: 'native' },
            { assetId: USDC, type: 'erc20' },
        ])
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
                        { ...usdcRow, usd_value: '1.5' },
                        { ...usdcRow, asset_id: DAI_CAIP19, type: 'algo' },
                        usdcRow,
                    ],
                }),
            ),
        )

        const rows = await fetchWhitelist(SCOPE)

        expect(rows).toEqual([
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

        await expect(fetchWhitelist(SCOPE)).rejects.toThrow()
    })

    it('rejects with a PeraNetworkError on a non-2xx answer', async () => {
        server.use(
            http.get(`${PERA_URL}/api/v3/evm/:chainId/tokens/`, () =>
                HttpResponse.json({}, { status: 422 }),
            ),
        )

        await expect(fetchWhitelist(SCOPE)).rejects.toBeInstanceOf(
            PeraNetworkError,
        )
    })
})

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

import { http, HttpResponse, type RequestHandler } from 'msw'
import {
    ASSETS_PATH,
    CHART_PATH,
    nftHoldingsPath,
    NFTS_PATH,
    whitelistPath,
} from './endpoints'
import type {
    AssetItemResponse,
    ChartPointResponse,
    NftItemResponse,
    WhitelistItemResponse,
} from './schema'
import { evmChainOfEip155Id } from '../../chains/table'

export type PeraEvmAssetFixtures = {
    /** Defaults to every host. */
    baseUrl?: string
    /**
     * Listed tokens keyed by EIP-155 chain id; a chain left out lists only
     * its native coin. A number fails every whitelist read with that status.
     */
    whitelist?: Record<number, WhitelistItemResponse[]> | number
    /**
     * Keyed by lowercase CAIP-19 id; an id left out answers as unknown. A
     * number fails every metadata read with that status.
     */
    assets?: Record<string, AssetItemResponse> | number
    /**
     * NFT holdings pages keyed by lowercase address; an address left out
     * holds none. A number fails every holdings read with that status.
     */
    nftHoldings?: Record<string, NftItemResponse[][]> | number
    /**
     * NFT metadata keyed by lowercase CAIP-19 id; an id left out answers
     * null. A number fails every metadata read with that status.
     */
    nfts?: Record<string, NftItemResponse> | number
    /**
     * Price charts keyed by lowercase CAIP-19 id, whatever the period; an id
     * left out answers 404 `chart_not_found`. A number fails every chart read
     * with that status.
     */
    charts?: Record<string, ChartPointResponse[]> | number
}

const BAYC = '0xbc4ca0eda7647a8ab7c2061c2e118a18a936f13d'

/** A held ERC-721 on Ethereum mainnet, as the NFT holdings endpoint lists it. */
export const evmNftItem = (
    overrides: Partial<NftItemResponse> = {},
): NftItemResponse => ({
    asset_id: `eip155:1/erc721:${BAYC}/1234`,
    standard: 'erc721',
    balance: '1',
    name: 'Bored Ape #1234',
    description: 'An ape.',
    collection: {
        address: BAYC,
        name: 'Bored Ape Yacht Club',
        symbol: 'BAYC',
        verification_tier: 'verified',
    },
    primary_image: {
        url: 'https://nft.pera.test/bayc/1234.png',
        preview_url: 'https://nft.pera.test/bayc/1234-preview.png',
    },
    media: [
        {
            type: 'image',
            url: 'https://nft.pera.test/bayc/1234.png',
            preview_url: 'https://nft.pera.test/bayc/1234-preview.png',
            mime_type: 'image/png',
        },
    ],
    traits: [{ name: 'Background', value: 'Orange' }],
    acquired_at: '2026-03-02T10:15:00Z',
    explorer_url: `https://etherscan.io/nft/${BAYC}/1234`,
    ...overrides,
})

const NFT_CURSOR = /^page:(\d+)$/

/** How the backend answers an id it has no metadata for; its type comes from the CAIP-19 namespace. */
export const unknownAssetItem = (caip19: string): AssetItemResponse => ({
    asset_id: caip19,
    type: caip19.includes('/slip44:') ? 'native' : 'erc20',
    name: null,
    unit_name: null,
    fraction_decimals: null,
    logo: null,
    usd_value: null,
    last_24_hours_usd_price_change_percentage: null,
    is_verified: false,
    verification_tier: 'unverified',
    explorer_url: null,
})

/** The whitelist's leading native row for an EIP-155 chain. */
export const nativeWhitelistItem = (
    eip155ChainId: number,
    slip44 = evmChainOfEip155Id(eip155ChainId)?.chain.row.nativeAsset.slip44 ??
        '60',
): WhitelistItemResponse => ({
    asset_id: `eip155:${eip155ChainId}/slip44:${slip44}`,
    type: 'native',
    name: 'Ether',
    unit_name: 'ETH',
    fraction_decimals: 18,
    logo: null,
    usd_value: null,
    last_24_hours_usd_price_change_percentage: null,
    is_verified: true,
    verification_tier: 'verified',
    explorer_url: null,
    is_swappable: true,
    is_fundable: true,
})

const failWith = (status: number) => HttpResponse.json({}, { status })

const INTEGRITY_BYPASS_VALUE = 'DEVELOPMENT_AND_STAGING_ONLY'

const hasIntegrityToken = (headers: Headers): boolean =>
    Boolean(headers.get('x-app-integrity-token')) ||
    /^Bearer\s+\S+$/i.test(headers.get('authorization') ?? '') ||
    headers.get('x-bypass-integrity') === INTEGRITY_BYPASS_VALUE

/**
 * The backend's guard on every EVM route: 401 without an API key, 403 without
 * an app-integrity token or the staging bypass. A request that skips
 * queryClient or `buildIntegrityHeaders` fails here as it would there.
 */
export const rejectUnauthenticated = (request: Request) => {
    if (!request.headers.get('x-api-key')) {
        return HttpResponse.json({ detail: 'Unauthorized' }, { status: 401 })
    }
    if (!hasIntegrityToken(request.headers)) {
        return HttpResponse.json(
            {
                error: 'App integrity token required',
                code: 'APP_INTEGRITY_TOKEN_REQUIRED',
            },
            { status: 403 },
        )
    }
    return undefined
}

/** The Pera backend's EVM whitelist and v4 asset metadata endpoints. */
export const peraEvmAssetHandlers = ({
    baseUrl = '*',
    whitelist = {},
    assets = {},
    nftHoldings = {},
    nfts = {},
    charts = {},
}: PeraEvmAssetFixtures = {}): RequestHandler[] => {
    const base = baseUrl.replace(/\/+$/, '')
    return [
        http.get(
            `${base}${whitelistPath(':chainId')}`,
            ({ request, params }) => {
                const refused = rejectUnauthenticated(request)
                if (refused) return refused
                if (typeof whitelist === 'number') return failWith(whitelist)
                const chainId = Number(params.chainId)
                return HttpResponse.json({
                    results: whitelist[chainId] ?? [
                        nativeWhitelistItem(chainId),
                    ],
                })
            },
        ),
        http.post(`${base}${ASSETS_PATH}`, async ({ request }) => {
            const refused = rejectUnauthenticated(request)
            if (refused) return refused
            if (typeof assets === 'number') return failWith(assets)
            const { ids } = (await request.json()) as { ids: string[] }
            // The backend answers every id lowercased.
            return HttpResponse.json({
                results: ids.map(id => {
                    const caip19 = id.toLowerCase()
                    return {
                        ...(assets[caip19] ?? unknownAssetItem(caip19)),
                        asset_id: caip19,
                    }
                }),
            })
        }),
        http.get(
            `${base}${nftHoldingsPath(':chainId', ':address')}`,
            ({ request, params }) => {
                const refused = rejectUnauthenticated(request)
                if (refused) return refused
                if (typeof nftHoldings === 'number') {
                    return failWith(nftHoldings)
                }
                const listed = nftHoldings[String(params.address).toLowerCase()]
                const pages = listed?.length ? listed : [[]]
                const cursor = new URL(request.url).searchParams.get('cursor')
                const index =
                    cursor === null
                        ? 0
                        : Number(NFT_CURSOR.exec(cursor)?.[1] ?? NaN)
                const results = pages[index]
                if (!results) {
                    return HttpResponse.json(
                        { error: 'Invalid cursor', code: 'invalid_cursor' },
                        { status: 404 },
                    )
                }
                return HttpResponse.json({
                    next: index + 1 < pages.length ? `page:${index + 1}` : null,
                    results,
                })
            },
        ),
        http.get(`${base}${CHART_PATH}`, ({ request }) => {
            const refused = rejectUnauthenticated(request)
            if (refused) return refused
            if (typeof charts === 'number') return failWith(charts)
            const id = new URL(request.url).searchParams.get('id') ?? ''
            const points = charts[id.toLowerCase()]
            return points
                ? HttpResponse.json(points)
                : HttpResponse.json(
                      {
                          error: 'No price chart for this asset',
                          code: 'chart_not_found',
                      },
                      { status: 404 },
                  )
        }),
        http.post(`${base}${NFTS_PATH}`, async ({ request }) => {
            const refused = rejectUnauthenticated(request)
            if (refused) return refused
            if (typeof nfts === 'number') return failWith(nfts)
            const { ids } = (await request.json()) as { ids: string[] }
            return HttpResponse.json({
                results: ids.map(id => {
                    const caip19 = id.toLowerCase()
                    const item = nfts[caip19]
                    return item ? { ...item, asset_id: caip19 } : null
                }),
            })
        }),
    ]
}

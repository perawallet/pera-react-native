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
import { ASSETS_PATH, whitelistPath } from './endpoints'
import type { AssetItemResponse, WhitelistItemResponse } from './schema'

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
}

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
): WhitelistItemResponse => ({
    asset_id: `eip155:${eip155ChainId}/slip44:60`,
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
    ]
}

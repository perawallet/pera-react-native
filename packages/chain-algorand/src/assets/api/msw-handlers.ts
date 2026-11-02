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

import { http, HttpResponse, type HttpHandler } from 'msw'
import type { z } from 'zod'
import { validateMockResponse } from '@perawallet/wallet-core-shared/test-utils'
import {
    assetItemResponseSchema,
    assetResponseSchema,
    assetsResponseSchema,
    indexerAssetResponseSchema,
    publicAssetResponseSchema,
} from './schema'

// Mock payloads are typed with the schema *input* (wire) shape, not the
// parsed output — e.g. asset ids may be numbers on the wire but are
// normalized to strings by `uint64IdSchema` during parsing.
export type MockAssetsParams = {
    response: z.input<typeof assetsResponseSchema>
    status?: number
}

export const mockAssets = ({
    response,
    status = 200,
}: MockAssetsParams): HttpHandler[] => {
    validateMockResponse(assetsResponseSchema, response, 'mockAssets')
    return [
        http.post('*/v2/assets/', () =>
            HttpResponse.json(response, { status }),
        ),
        http.get('*/v1/assets/', () => HttpResponse.json(response, { status })),
    ]
}

export type MockAssetDetailsParams = {
    assetID: string
    response: z.input<typeof assetResponseSchema>
    status?: number
}

export const mockAssetDetails = ({
    assetID,
    response,
    status = 200,
}: MockAssetDetailsParams): HttpHandler => {
    validateMockResponse(assetResponseSchema, response, 'mockAssetDetails')
    return http.get(`*/v1/assets/${assetID}/`, () =>
        HttpResponse.json(response, { status }),
    )
}

export type MockPublicAssetDetailsParams = {
    assetID: string
    response: z.input<typeof publicAssetResponseSchema>
    status?: number
}

export const mockPublicAssetDetails = ({
    assetID,
    response,
    status = 200,
}: MockPublicAssetDetailsParams): HttpHandler => {
    validateMockResponse(
        publicAssetResponseSchema,
        response,
        'mockPublicAssetDetails',
    )
    return http.get(`*/v1/public/assets/${assetID}/`, () =>
        HttpResponse.json(response, { status }),
    )
}

export type MockIndexerAssetDetailsParams = {
    assetID: string
    response: z.input<typeof indexerAssetResponseSchema>
    status?: number
}

export const mockIndexerAssetDetails = ({
    assetID,
    response,
    status = 200,
}: MockIndexerAssetDetailsParams): HttpHandler => {
    validateMockResponse(
        indexerAssetResponseSchema,
        response,
        'mockIndexerAssetDetails',
    )
    return http.get(`*/v2/assets/${assetID}`, () =>
        HttpResponse.json(response, { status }),
    )
}

export type MockAssetItem = Omit<
    z.input<typeof assetItemResponseSchema>,
    'asset_id' | 'cross_chain_asset_group'
>

export type MockAssetItemsParams = {
    /** Each served ASA's item, by ASA id. */
    items?: Record<string, MockAssetItem>
    /** Each grouped ASA's group, by ASA id; any other id answers null. */
    groups?: Record<string, { id: string; name: string; symbol: string }>
    status?: number
}

// What v4 answers for an ASA it has no row for; sync skips it.
const unknownAssetItem = (): MockAssetItem => ({
    type: null,
    name: null,
    unit_name: null,
    fraction_decimals: null,
    logo: null,
    is_verified: false,
    verification_tier: 'unverified',
    explorer_url: null,
    total: null,
    is_deleted: false,
    creator: null,
    collectible: null,
    category: null,
    labels: [],
    is_favorited: false,
    is_price_alert_enabled: false,
})

/**
 * The v4 asset item. Answers a request naming Algorand ids alone and falls
 * through otherwise, so an EVM handler on the same path still sees its own.
 * An id with no item answers as an ASA the backend has no row for.
 */
export const mockAssetItems = ({
    items = {},
    groups = {},
    status = 200,
}: MockAssetItemsParams = {}): HttpHandler => {
    for (const item of Object.values(items)) {
        validateMockResponse(
            assetItemResponseSchema,
            { ...item, asset_id: 'algorand:mock/asa:0' },
            'mockAssetItems',
        )
    }
    return http.post('*/api/v4/assets/', async ({ request }) => {
        const { ids } = (await request.clone().json()) as { ids: string[] }
        if (!ids.every(id => id.startsWith('algorand:'))) return undefined
        if (status !== 200) {
            return HttpResponse.json(
                {
                    error: 'No device matches the given query.',
                    code: 'device_not_found',
                },
                { status },
            )
        }
        return HttpResponse.json({
            results: ids.map(id => {
                const assetId = id.slice(id.lastIndexOf(':') + 1)
                return {
                    ...(items[assetId] ?? unknownAssetItem()),
                    asset_id: id,
                    cross_chain_asset_group: groups[assetId] ?? null,
                }
            }),
        })
    })
}

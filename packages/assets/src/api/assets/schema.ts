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

import { z } from 'zod'

export const assetResponseSchema = z.object({
    asset_id: z.number(),
    name: z.string().optional(),
    logo: z.string().nullable().optional(),
    unit_name: z.string().optional(),
    fraction_decimals: z.number(),
    total: z.string(),
    usd_value: z.string().nullable().optional(),
    is_verified: z.boolean().optional().nullable(),
    is_deleted: z.boolean().optional().nullable(),
    verification_tier: z.string(),
    explorer_url: z.string().optional(),
    collectible: z.any().optional(),
    creator: z.object({
        address: z.string(),
    }),
    type: z.string().optional(),
    category: z.number().nullable(),
    labels: z.array(z.any()).optional(),
    is_favorited: z.boolean().optional(),
    is_price_alert_enabled: z.boolean().optional(),
})

export const assetsResponseSchema = z.object({
    results: z.array(assetResponseSchema),
    next: z.string().nullable().optional(),
    previous: z.string().nullable().optional(),
})

export const publicAssetResponseSchema = z.object({
    asset_id: z.number(),
    name: z.string().optional(),
    unit_name: z.string().optional(),
    fraction_decimals: z.number(),
    total_supply: z.number(),
    total_supply_as_str: z.string(),
    is_deleted: z.boolean().optional().nullable(),
    creator_address: z.string().optional().nullable(),
    url: z.string().optional(),
    logo: z.string().optional(),
    verification_tier: z.string(),
    usd_value: z.string().nullable().optional(),
    usd_value_24_hour_ago: z.string().nullable().optional(),
    is_collectible: z.boolean(),
})

export const indexerAssetResponseSchema = z.object({
    asset: z.object({
        'created-at-round': z.number().optional(),
        deleted: z.boolean().optional(),
        'destroyed-at-round': z.number().optional(),
        index: z.number(),
        params: z.object({
            clawback: z.string().optional(),
            creator: z.string(),
            decimals: z.number(),
            'default-frozen': z.boolean().optional(),
            freeze: z.string().optional(),
            manager: z.string().optional(),
            'metadata-hash': z.string().optional(),
            name: z.string().optional(),
            'name-b64': z.string().optional(),
            reserve: z.string().optional(),
            total: z.number(),
            'unit-name': z.string().optional(),
            'unit-name-b64': z.string().optional(),
            url: z.string().optional(),
            'url-b64': z.string().optional(),
        }),
    }),
    'current-round': z.number(),
})


export type PublicAssetResponse = z.infer<typeof publicAssetResponseSchema>
export type AssetResponse = z.infer<typeof assetResponseSchema>
export type AssetsResponse = z.infer<typeof assetsResponseSchema>
export type IndexerAssetResponse = z.infer<typeof indexerAssetResponseSchema>

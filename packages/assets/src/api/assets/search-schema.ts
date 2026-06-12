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
import { uint64IdSchema } from '@perawallet/wallet-core-shared'

const collectibleSearchSchema = z.object({
    collection: z
        .object({
            collection_id: uint64IdSchema.nullable().optional(),
            name: z.string().nullable().optional(),
        })
        .nullable()
        .optional(),
    primary_image: z.string().nullable().optional(),
    title: z.string().nullable().optional(),
})

const assetSearchResultSchema = z.object({
    asset_id: uint64IdSchema,
    name: z.string().nullable().optional(),
    logo: z.string().nullable().optional(),
    unit_name: z.string().nullable().optional(),
    verification_tier: z.enum(['verified', 'unverified', 'suspicious']),
    usd_value: z.string().nullable().optional(),
    type: z
        .enum(['algo', 'standard_asset', 'dapp_asset', 'collectible'])
        .nullable()
        .optional(),
    collectible: collectibleSearchSchema.nullable().optional(),
    category: z.number().nullable().optional(),
})

export const assetSearchResponseSchema = z.object({
    results: z.array(assetSearchResultSchema),
    next: z.string().nullable().optional(),
    previous: z.string().nullable().optional(),
})

export type AssetSearchResultResponse = z.infer<typeof assetSearchResultSchema>
export type AssetSearchResponse = z.infer<typeof assetSearchResponseSchema>

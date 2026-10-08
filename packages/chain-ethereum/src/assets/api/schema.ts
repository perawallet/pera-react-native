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

import { z } from 'zod'

export const assetItemSchema = z.object({
    /** CAIP-19. */
    asset_id: z.string(),
    type: z
        .enum([
            'native',
            'erc20',
            'algo',
            'standard_asset',
            'collectible',
            'dapp_asset',
        ])
        .nullable(),
    name: z.string().nullable(),
    unit_name: z.string().nullable(),
    fraction_decimals: z.number().int().min(0).nullable(),
    logo: z.string().nullable(),
    usd_value: z
        .string()
        .regex(/^\d+\.\d{24}$/)
        .nullable(),
    last_24_hours_usd_price_change_percentage: z.number().nullable(),
    is_verified: z.boolean(),
    verification_tier: z.enum(['unverified', 'verified', 'suspicious']),
    explorer_url: z.string().nullable(),
})

export type AssetItemSchemaOutput = z.output<typeof assetItemSchema>

export type AssetItemResponse = z.input<typeof assetItemSchema>

export const whitelistItemSchema = assetItemSchema.extend({
    is_swappable: z.boolean(),
    is_fundable: z.boolean(),
})

export type WhitelistItemResponse = z.input<typeof whitelistItemSchema>

export const assetsResponseSchema = z.object({
    results: z.array(assetItemSchema),
})

// Rows are checked one by one, so a row of a kind this client predates (an
// NFT type, a new tier) drops that row rather than every account read.
export const whitelistResponseSchema = z.object({
    results: z.array(z.unknown()),
})

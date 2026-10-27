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

export type WhitelistItemSchemaOutput = z.output<typeof whitelistItemSchema>

export const assetsResponseSchema = z.object({
    results: z.array(assetItemSchema),
})

// Rows are checked one by one, so a row of a kind this client predates (an
// NFT type, a new tier) drops that row rather than every account read.
export const whitelistResponseSchema = z.object({
    results: z.array(z.unknown()),
})

// A second gate behind the backend's: only https media reaches the app, so a
// `data:` SVG or an `ipfs://` link clears its field instead of failing the item.
const isHttpsUrl = (value: string): boolean => {
    try {
        return new URL(value).protocol === 'https:'
    } catch {
        return false
    }
}

export const httpsUrlOrNull = z
    .string()
    .nullable()
    .transform(value => (value !== null && isHttpsUrl(value) ? value : null))

const evmAddress = z.string().regex(/^0x[0-9a-fA-F]{40}$/)

const nftMediaSchema = z.object({
    type: z.enum(['image', 'video', 'audio', 'model', 'unknown']),
    url: httpsUrlOrNull,
    preview_url: httpsUrlOrNull,
    mime_type: z.string().nullable(),
})

type NftMediaOutput = z.output<typeof nftMediaSchema> & { url: string }

// One unreadable or unsafe media entry drops itself, not the token.
const nftMediaListSchema = z.array(z.unknown()).transform(entries =>
    entries.flatMap(entry => {
        const parsed = nftMediaSchema.safeParse(entry)
        return parsed.success && parsed.data.url !== null
            ? [parsed.data as NftMediaOutput]
            : []
    }),
)

export const nftItemSchema = z.object({
    /** CAIP-19: `eip155:{chain}/{erc721|erc1155}:{contract}/{token id}`. */
    asset_id: z.string(),
    standard: z.enum(['erc721', 'erc1155']),
    /** Base units, decimal. Absent on the metadata endpoint. */
    balance: z.string().regex(/^\d+$/).optional(),
    name: z.string().nullable(),
    description: z.string().nullable(),
    collection: z.object({
        address: evmAddress,
        name: z.string().nullable(),
        symbol: z.string().nullable(),
        verification_tier: z.enum(['unverified', 'verified', 'suspicious']),
    }),
    primary_image: z
        .object({ url: httpsUrlOrNull, preview_url: httpsUrlOrNull })
        .nullable(),
    media: nftMediaListSchema,
    traits: z.array(
        z.object({
            name: z.string().nullable(),
            value: z.union([z.string(), z.number()]).transform(String),
        }),
    ),
    acquired_at: z.iso.datetime({ offset: true }).nullable().optional(),
    explorer_url: httpsUrlOrNull,
})

export type NftItemSchemaOutput = z.output<typeof nftItemSchema>

export type NftItemResponse = z.input<typeof nftItemSchema>

// Rows are checked one by one, so one unreadable token drops itself rather
// than the whole holdings read.
export const nftHoldingsPageSchema = z.object({
    results: z.array(z.unknown()),
    next: z.string().nullable(),
})

export const nftsResponseSchema = z.object({
    results: z.array(z.unknown()),
})

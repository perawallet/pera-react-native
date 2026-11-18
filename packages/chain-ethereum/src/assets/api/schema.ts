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
import type { Nullable } from '@perawallet/wallet-core-shared'

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
    /**
     * Base units. Null for the native coin, a quarantined token, or one the
     * backend hasn't read yet; absent on the whitelist, which doesn't carry it.
     */
    total: z.string().regex(/^\d+$/).nullable().optional(),
    // Optional: a source that doesn't carry it leaves the stored group alone.
    cross_chain_asset_group: z
        .object({ id: z.string(), name: z.string(), symbol: z.string() })
        .nullable()
        .optional(),
})

export type AssetItemSchemaOutput = z.output<typeof assetItemSchema>

export type AssetItemResponse = z.input<typeof assetItemSchema>

export const whitelistItemSchema = assetItemSchema.extend({
    is_swappable: z.boolean(),
    is_fundable: z.boolean(),
})

export type WhitelistItemResponse = z.input<typeof whitelistItemSchema>

export type WhitelistItemSchemaOutput = z.output<typeof whitelistItemSchema>

// Rows are checked one by one, so one row of a shape this client predates (a
// new tier, a price at another precision) prices that asset as a miss rather
// than failing every asset in the request.
export const assetsResponseSchema = z.object({
    results: z.array(z.object({ asset_id: z.string() }).passthrough()),
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
    .nullish()
    .transform(value =>
        typeof value === 'string' && isHttpsUrl(value) ? value : null,
    )

const nullishString = z
    .string()
    .nullish()
    .transform(value => value ?? null)

const evmAddress = z.string().regex(/^0x[0-9a-fA-F]{40}$/)

// The backend's media entries carry no type; it is derived from `mime_type`.
const nftMediaSchema = z.object({
    url: httpsUrlOrNull,
    preview_url: httpsUrlOrNull,
    mime_type: nullishString,
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

const nftTraitSchema = z.object({
    trait_type: nullishString,
    value: z.union([z.string(), z.number()]).transform(String),
})

// One unreadable trait drops itself, not the token.
const nftTraitListSchema = z.array(z.unknown()).transform(entries =>
    entries.flatMap(entry => {
        const parsed = nftTraitSchema.safeParse(entry)
        return parsed.success ? [parsed.data] : []
    }),
)

/** The backend's documented NFT item, on both the holdings and metadata routes. */
export type NftItemResponse = {
    /** CAIP-19: `eip155:{chain}/{erc721|erc1155}:{contract}/{token id}`. */
    asset_id: string
    standard: 'erc721' | 'erc1155'
    token_id: string
    /** Base units, decimal; null on the metadata route, which isn't per account. */
    // lanekeep-ignore-next-line pera/amount-types reason: JSON wire response shape
    balance: Nullable<string>
    name: Nullable<string>
    description: Nullable<string>
    collection: {
        address: string
        name: Nullable<string>
        symbol: Nullable<string>
        verification_tier: 'unverified' | 'verified' | 'suspicious'
    }
    primary_image: Nullable<{ url: string; preview_url: Nullable<string> }>
    media: {
        url: string
        preview_url: Nullable<string>
        mime_type: Nullable<string>
    }[]
    traits: { trait_type: Nullable<string>; value: string }[]
    acquired_at: Nullable<string>
    explorer_url: Nullable<string>
    cross_chain_asset_group: null
}

export const nftItemSchema = z.object({
    /** CAIP-19: `eip155:{chain}/{erc721|erc1155}:{contract}/{token id}`. */
    asset_id: z.string(),
    standard: z.enum(['erc721', 'erc1155']),
    balance: z
        .string()
        .regex(/^\d+$/)
        .nullish()
        .transform(value => value ?? null),
    name: nullishString,
    description: nullishString,
    collection: z.object({
        address: evmAddress,
        name: nullishString,
        symbol: nullishString,
        verification_tier: z.enum(['unverified', 'verified', 'suspicious']),
    }),
    primary_image: z
        .object({ url: httpsUrlOrNull, preview_url: httpsUrlOrNull })
        .nullish()
        .transform(value => value ?? null),
    media: nftMediaListSchema,
    traits: nftTraitListSchema,
    explorer_url: httpsUrlOrNull,
})

export type NftItemSchemaOutput = z.output<typeof nftItemSchema>

// Rows are checked one by one, so one unreadable token drops itself rather
// than the whole holdings read.
export const nftHoldingsPageSchema = z.object({
    results: z.array(z.unknown()),
    next: z.string().nullable(),
})

// Rows are checked one by one, as on the assets route.
export const tokenSearchPageSchema = z.object({
    results: z.array(z.unknown()),
    next: z.string().nullable(),
})

export const nftsResponseSchema = z.object({
    results: z.array(z.unknown()),
})

export const chartPointSchema = z.object({
    /** UTC, to the second. */
    datetime: z.string(),
    /** USD per whole unit. */
    price: z.string().regex(/^\d+\.\d{24}$/),
})

export const chartResponseSchema = z.array(chartPointSchema)

export type ChartPointResponse = z.infer<typeof chartPointSchema>

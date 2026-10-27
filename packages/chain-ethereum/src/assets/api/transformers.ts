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

import { Decimal } from 'decimal.js'
import { getAddress } from 'viem'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import {
    PeraAssetType,
    type AssetPriceRow,
    type CollectibleMedia,
    type CollectibleMediaType,
    type DisplayableAsset,
    type PeraAsset,
    type PeraCollectible,
} from '@perawallet/wallet-core-assets'
import type { Nullable } from '@perawallet/wallet-core-shared'
import {
    fromCaip19,
    InvalidCaip19Error,
    isEvmNftAssetId,
} from '../../blockchain/utils/caip19'
import type { EvmChain } from '../../chains/types'
import {
    whitelistItemSchema,
    type AssetItemSchemaOutput,
    type NftItemSchemaOutput,
    type WhitelistItemSchemaOutput,
} from './schema'

/**
 * `asset` is null when the backend has no metadata for the token: it does not
 * know it, or it quarantined it (`isQuarantined`).
 */
export type AssetMetadata = {
    assetId: string
    asset: Nullable<PeraAsset>
    isQuarantined: boolean
}

export type WhitelistRow = {
    /** App asset id: the native id or a checksummed contract address. */
    assetId: string
    type: 'native' | 'erc20'
    /** The row as a search result shows it. */
    asset: DisplayableAsset
}

// isFavorited and isPriceAlertEnabled stay unset: the persisted row keeps the
// user's own flags only when the incoming ones are absent.
const toPeraAsset = (
    assetId: string,
    item: AssetItemSchemaOutput,
): Nullable<PeraAsset> =>
    item.fraction_decimals === null
        ? null
        : {
              assetId,
              name: item.name ?? undefined,
              unitName: item.unit_name ?? undefined,
              decimals: item.fraction_decimals,
              // The backend sends no supply: 0 unless the asset came from a
              // chain read.
              totalSupply: new Decimal(0),
              creator: { address: '' },
              peraMetadata: {
                  isDeleted: false,
                  verificationTier: item.verification_tier,
                  logo: item.logo,
                  type: PeraAssetType.standard_asset,
              },
          }

// The backend withholds a quarantined token's metadata but keeps its tier.
const isQuarantined = (item: AssetItemSchemaOutput): boolean =>
    item.fraction_decimals === null && item.verification_tier === 'suspicious'

export const toAssetMetadata = (
    assetId: string,
    item: AssetItemSchemaOutput,
): AssetMetadata => ({
    assetId,
    asset: toPeraAsset(assetId, item),
    isQuarantined: isQuarantined(item),
})

/** Null when the backend has no price: a miss, never a zero price. */
export const toPriceRow = (
    assetId: string,
    item: AssetItemSchemaOutput,
): Nullable<AssetPriceRow> =>
    item.usd_value === null
        ? null
        : { assetId, usdPrice: new Decimal(item.usd_value) }

const appAssetIdOfListed = (
    { asset_id }: WhitelistItemSchemaOutput,
    scope: ChainScope,
    chain: EvmChain,
): Nullable<string> => {
    try {
        return fromCaip19(asset_id, scope, chain)
    } catch (error) {
        if (error instanceof InvalidCaip19Error) return null
        throw error
    }
}

export const toWhitelistRow = (
    row: unknown,
    scope: ChainScope,
    chain: EvmChain,
): Nullable<WhitelistRow> => {
    const parsed = whitelistItemSchema.safeParse(row)
    if (!parsed.success) return null
    const item = parsed.data
    const { type } = item
    if (type !== 'native' && type !== 'erc20') return null
    const assetId = appAssetIdOfListed(item, scope, chain)
    if (assetId === null) return null
    return {
        assetId,
        type,
        asset: {
            assetId,
            name: item.name ?? undefined,
            unitName: item.unit_name ?? undefined,
            decimals: item.fraction_decimals ?? undefined,
            peraMetadata: {
                logo: item.logo,
                verificationTier: item.verification_tier,
                type: PeraAssetType.standard_asset,
            },
        },
    }
}

export type NftHolding = {
    asset: PeraAsset
    /** Base units; an NFT has no decimals, so also the held quantity. */
    amount: Decimal
}

const appAssetIdOf = (
    caip19: string,
    scope: ChainScope,
    chain: EvmChain,
): Nullable<string> => {
    try {
        return fromCaip19(caip19, scope, chain)
    } catch (error) {
        if (error instanceof InvalidCaip19Error) return null
        throw error
    }
}

// `image/png` → `png`; the media list keeps no file name to read it from.
const extensionOf = (mimeType: Nullable<string>): string =>
    mimeType?.split('/')[1]?.split(';')[0]?.trim() ?? ''

const toCollectible = (item: NftItemSchemaOutput): PeraCollectible => {
    const primaryImage =
        item.primary_image?.preview_url ?? item.primary_image?.url ?? undefined
    const media: CollectibleMedia[] = item.media.map(entry => ({
        type: entry.type,
        downloadUrl: entry.url,
        previewUrl: entry.preview_url ?? undefined,
        extension: extensionOf(entry.mime_type),
    }))
    const mediaType: CollectibleMediaType =
        media[0]?.type ?? (primaryImage ? 'image' : 'unknown')
    return {
        title: item.name ?? undefined,
        standard: item.standard,
        primaryImage,
        mediaType,
        explorerUrl: item.explorer_url ?? undefined,
        collection: item.collection.name
            ? { name: item.collection.name }
            : undefined,
        description: item.description ?? undefined,
        traits: item.traits.map(trait => ({
            displayName: trait.name ?? undefined,
            displayValue: trait.value,
        })),
        media,
    }
}

/** Null for an id that isn't an NFT on the scope's chain. */
export const toNftAsset = (
    item: NftItemSchemaOutput,
    scope: ChainScope,
    chain: EvmChain,
): Nullable<PeraAsset> => {
    const assetId = appAssetIdOf(item.asset_id, scope, chain)
    if (assetId === null || !isEvmNftAssetId(assetId)) return null
    const collectible = toCollectible(item)
    // isFavorited and isPriceAlertEnabled stay unset, as in toPeraAsset.
    return {
        assetId,
        name: item.name ?? undefined,
        unitName: item.collection.symbol ?? undefined,
        decimals: 0,
        totalSupply: new Decimal(0),
        creator: { address: getAddress(item.collection.address) },
        peraMetadata: {
            isDeleted: false,
            verificationTier: item.collection.verification_tier,
            type: PeraAssetType.collectible,
            isUnique: item.standard === 'erc721',
            explorerUrl: collectible.explorerUrl,
            logo: collectible.primaryImage ?? null,
            collectible,
        },
    }
}

/** Null for an item that isn't held: no balance, or a zero one. */
export const toNftHolding = (
    item: NftItemSchemaOutput,
    scope: ChainScope,
    chain: EvmChain,
): Nullable<NftHolding> => {
    if (item.balance === undefined) return null
    const amount = new Decimal(item.balance)
    if (amount.isZero()) return null
    const asset = toNftAsset(item, scope, chain)
    return asset ? { asset, amount } : null
}

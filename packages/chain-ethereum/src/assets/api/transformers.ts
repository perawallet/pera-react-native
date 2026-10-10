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
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import {
    PeraAssetType,
    type AssetPriceRow,
    type PeraAsset,
} from '@perawallet/wallet-core-assets'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { fromCaip19, InvalidCaip19Error } from '../../blockchain/utils/caip19'
import { whitelistItemSchema, type AssetItemSchemaOutput } from './schema'

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

export const toWhitelistRow = (
    row: unknown,
    scope: ChainScope,
): Nullable<WhitelistRow> => {
    const parsed = whitelistItemSchema.safeParse(row)
    if (!parsed.success) return null
    const { type, asset_id } = parsed.data
    if (type !== 'native' && type !== 'erc20') return null
    try {
        return { assetId: fromCaip19(asset_id, scope), type }
    } catch (error) {
        if (error instanceof InvalidCaip19Error) return null
        throw error
    }
}

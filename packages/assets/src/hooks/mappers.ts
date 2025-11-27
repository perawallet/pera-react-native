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

import Decimal from 'decimal.js'
import {
    ALGO_ASSET_ID,
    type AssetPriceHistoryResponseItem,
    type AssetPriceResponse,
    type AssetResponse,
    type IndexerAssetResponse,
    type PeraAsset,
    type PublicAssetResponse,
} from '../models'

export const mapAssetPriceResponseToAssetPrice = (
    data: AssetPriceResponse,
    usdToPreferred: (amount: Decimal) => Decimal,
) => {
    return {
        assetId: data.asset_id,
        fiatPrice: usdToPreferred(Decimal(data.usd_value ?? '0')),
    }
}

export const mapAssetPriceHistoryResponseToAssetPriceHistoryItem = (
    data: AssetPriceHistoryResponseItem,
    usdToPreferred: (amount: Decimal) => Decimal,
) => {
    return {
        datetime: new Date(data.datetime),
        fiatPrice: usdToPreferred(Decimal(data.price ?? '0')),
    }
}

export const mapAssetResponseToPeraAsset = (data: AssetResponse): PeraAsset => {
    return {
        assetId: `${data.asset_id}`,
        name: data.name,
        peraMetadata: {
            isDeleted: data.is_deleted,
            verificationTier: data.verification_tier,
            category: data.category ?? undefined,
            isVerified: data.is_verified,
            explorerUrl: data.explorer_url,
            collectible: data.collectible,
            type: data.type,
            labels: data.labels,
            logo: data.logo,
        },
        unitName: data.unit_name,
        decimals: data.fraction_decimals,
        totalSupply: Decimal(data.total ?? '0'),
        creator: data.creator,
    }
}

export const mapIndexerAssetToPeraAsset = (
    response: IndexerAssetResponse,
): PeraAsset => {
    const asset = response.asset
    return {
        assetId: `${asset.index}`,
        decimals: asset.params.decimals,
        unitName: asset.params['unit-name'],
        name: asset.params.name,
        totalSupply: Decimal(`${asset.params.total}`),
        creator: {
            address: asset.params.creator,
        },
        url: asset.params.url,
    }
}

export const mapPublicAssetResponseToPeraAsset = (
    asset: PublicAssetResponse,
): PeraAsset => {
    return {
        assetId: `${asset.asset_id}`,
        name: asset.name,
        peraMetadata: {
            isDeleted: asset.is_deleted === 'true',
            verificationTier: asset.verification_tier,
            isVerified: asset.verification_tier === 'verified' || `${asset.asset_id}` === ALGO_ASSET_ID,
            logo: asset.logo,
        },
        unitName: asset.unit_name,
        decimals: asset.fraction_decimals,
        totalSupply: Decimal(asset.total_supply_as_str),
        creator: {
            address: asset.creator_address,
        },
        url: asset.url,
    }
}

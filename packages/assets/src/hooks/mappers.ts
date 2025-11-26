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
import type {
    AssetPriceHistoryResponseItem,
    AssetPriceResponse,
    AssetResponse,
    IndexerAssetResponse,
    PeraAsset,
    PublicAssetResponse,
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
        logo: data.logo,
        unitName: data.unit_name,
        decimals: data.fraction_decimals,
        totalSupply: Decimal(data.total ?? '0'),
        isDeleted: data.is_deleted,
        verificationTier: data.verification_tier,
        creator: data.creator,
        category: data.category ?? undefined,
        isVerified: data.is_verified,
        explorerUrl: data.explorer_url,
        collectible: data.collectible,
        type: data.type,
        labels: data.labels,
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
        isDeleted: asset.deleted ?? false,
        verificationTier: 'unverified',
        creator: {
            address: asset.params.creator,
        },
        category: 0, //TODO check this is right
        isVerified: true,
        url: asset.params.url,
    }
}

export const mapPublicAssetResponseToPeraAsset = (
    asset: PublicAssetResponse,
): PeraAsset => {
    return {
        assetId: `${asset.asset_id}`,
        name: asset.name,
        logo: asset.logo,
        unitName: asset.unit_name,
        decimals: asset.fraction_decimals,
        totalSupply: Decimal(asset.total_supply_as_str),
        isDeleted: asset.is_deleted === 'true',
        verificationTier: asset.verification_tier,
        creator: {
            address: asset.creator_address,
        },
        category: 0,
        isVerified:
            asset.verification_tier === 'verified' || asset.asset_id === 0,
        url: asset.url,
    }
}

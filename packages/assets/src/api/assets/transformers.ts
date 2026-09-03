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
import { isAlgoAssetId, type Optional } from '@perawallet/wallet-core-shared'
import type {
    PeraAssetType,
    PeraAssetVerificationTier,
    PeraAsset,
    PeraCollectible,
    CollectibleMediaType,
    CollectibleStandard,
} from '../../models'
import type {
    AssetResponse,
    CollectibleResponse,
    IndexerAssetResponse,
    PublicAssetResponse,
} from './schema'

const MODEL_EXTENSIONS = new Set(['glb', 'gltf', 'usdz'])

export const resolveMediaType = (
    type: string,
    extension: string,
): CollectibleMediaType => {
    if (type === 'unknown' && MODEL_EXTENSIONS.has(extension.toLowerCase())) {
        return 'model'
    }
    return type as CollectibleMediaType
}

export const transformCollectibleResponse = (
    data: CollectibleResponse,
): PeraCollectible => {
    return {
        title: data.title,
        standard: data.standard as Optional<CollectibleStandard>,
        primaryImage: data.primary_image ?? undefined,
        mediaType: data.media_type as CollectibleMediaType,
        explorerUrl: data.explorer_url,
        collection: data.collection
            ? {
                  id: data.collection.id,
                  name: data.collection.name,
                  description: data.collection.description,
              }
            : undefined,
        description: data.description,
        traits: (data.traits ?? []).map(t => ({
            displayName: t.display_name,
            displayValue: t.display_value,
        })),
        media: (data.media ?? []).map(m => ({
            type: resolveMediaType(m.type, m.extension),
            downloadUrl: m.download_url,
            previewUrl: m.preview_url,
            extension: m.extension,
        })),
    }
}

export const transformAssetResponse = (data: AssetResponse): PeraAsset => {
    return {
        assetId: `${data.asset_id}`,
        name: data.name,
        peraMetadata: {
            isDeleted: data.is_deleted ?? false,
            verificationTier:
                data.verification_tier as PeraAssetVerificationTier,
            category: data.category ?? undefined,
            isVerified: data.is_verified ?? false,
            explorerUrl: data.explorer_url ?? undefined,
            collectible: data.collectible
                ? transformCollectibleResponse(data.collectible)
                : undefined,
            type: data.type as PeraAssetType,
            labels: data.labels ?? undefined,
            logo: data.logo,
            isFavorited: data.is_favorited,
            isPriceAlertEnabled: data.is_price_alert_enabled,
            description: data.description ?? undefined,
            projectUrl: data.project_url ?? undefined,
            projectName: data.project_name ?? undefined,
            discordUrl: data.discord_url ?? undefined,
            telegramUrl: data.telegram_url ?? undefined,
            twitterUsername: data.twitter_username ?? undefined,
        },
        unitName: data.unit_name,
        decimals: data.fraction_decimals,
        totalSupply: new Decimal(data.total ?? '0'),
        creator: data.creator,
        url: data.url ?? undefined,
    }
}

export const transformIndexerAssetResponse = (
    response: IndexerAssetResponse,
): PeraAsset => {
    const asset = response.asset
    return {
        assetId: `${asset.index}`,
        decimals: asset.params.decimals,
        unitName: asset.params['unit-name'],
        name: asset.params.name,
        totalSupply: new Decimal(`${asset.params.total}`),
        creator: {
            address: asset.params.creator,
        },
        url: asset.params.url,
    }
}

export const transformPublicAssetResponse = (
    asset: PublicAssetResponse,
): PeraAsset => {
    return {
        assetId: `${asset.asset_id}`,
        name: asset.name ?? undefined,
        peraMetadata: {
            isDeleted: asset.is_deleted === true,
            verificationTier:
                asset.verification_tier as PeraAssetVerificationTier,
            isVerified:
                asset.verification_tier === 'verified' ||
                isAlgoAssetId(asset.asset_id),
            logo: asset.logo,
        },
        unitName: asset.unit_name ?? undefined,
        decimals: asset.fraction_decimals,
        totalSupply: new Decimal(asset.total_supply_as_str),
        creator: {
            address: asset.creator_address ?? '',
        },
        url: asset.url ?? undefined,
    }
}

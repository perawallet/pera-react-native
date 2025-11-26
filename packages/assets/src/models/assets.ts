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

export const PeraAssetVerificationTier = {
    verified: 'verified',
    suspicious: 'suspicious',
    unverified: 'unverified',
} as const

export type PeraAssetVerificationTier =
    (typeof PeraAssetVerificationTier)[keyof typeof PeraAssetVerificationTier]

export const PeraAssetType = {
    algo: 'algo',
    standard_asset: 'standard_asset',
    dapp_asset: 'dapp_asset',
    collectible: 'collectible',
} as const

export type PeraAssetType = (typeof PeraAssetType)[keyof typeof PeraAssetType]

export type PeraCollectible = {
    //TODO: Add collectible type
}

export type PeraAssetLabel = {
    //TODO: Add asset label type
}

export type CreatorAccount = {
    address: string
}

export type PeraAsset = {
    assetId: string
    decimals: number
    totalSupply: Decimal
    isDeleted: boolean
    verificationTier: PeraAssetVerificationTier
    creator: CreatorAccount
    category?: number //TODO: Add category type
    name?: string
    logo?: string | null
    unitName?: string
    readonly isVerified?: boolean
    readonly explorerUrl?: string
    collectible?: PeraCollectible
    type?: PeraAssetType
    readonly labels?: PeraAssetLabel[]
    projectUrl?: string
    projectName?: string
    readonly logoSvg?: string | null
    discordUrl?: string
    telegramUrl?: string
    twitterUsername?: string
    description?: string
    url?: string
    readonly availableOnDiscoverMobile?: string
}

export const ALGO_ASSET_ID = '0'

export const ALGO_ASSET: PeraAsset = {
    assetId: ALGO_ASSET_ID,
    decimals: 6,
    totalSupply: Decimal('10000000000000000000'), //10,000 T microalgos
    isDeleted: false,
    verificationTier: 'verified',
    creator: {
        address: '',
    },
    isVerified: true,
    category: 0,
}

export type IndexerAssetResponse = {
    asset: {
        'created-at-round'?: number
        deleted?: boolean
        'destroyed-at-round'?: number
        index: number
        params: {
            clawback?: string
            creator: string
            decimals: number
            'default-frozen'?: boolean
            freeze?: string
            manager?: string
            'metadata-hash'?: string
            name?: string
            'name-b64'?: string
            reserve?: string
            total: number
            'unit-name'?: string
            'unit-name-b64'?: string
            url?: string
            'url-b64'?: string
        }
    }
    'current-round': number
}

export type PublicAssetResponse = {
    asset_id: number
    name?: string
    unit_name?: string
    fraction_decimals: number
    total_supply: number
    total_supply_as_str: string
    readonly is_deleted?: string
    creator_address: string
    url?: string
    logo?: string
    verification_tier: PeraAssetVerificationTier
    usd_value?: string | null
    usd_value_24_hour_ago?: string | null
    is_collectible: boolean
}

export type AssetResponse = {
    asset_id: number
    name?: string
    logo?: string | null
    unit_name?: string
    fraction_decimals: number
    total: string
    usd_value?: string | null
    readonly is_verified?: boolean
    is_deleted: boolean
    verification_tier: PeraAssetVerificationTier
    explorer_url?: string
    collectible?: PeraCollectible
    creator: CreatorAccount
    type?: PeraAssetType
    category: number | null
    readonly labels?: PeraAssetLabel[]
}

export type AssetsResponse = {
    results: AssetResponse[]
    next: string | null | undefined
    previous: string | null | undefined
}

export type AssetPricesResponse = {
    results: AssetPriceResponse[]
    next: string | null | undefined
    previous: string | null | undefined
}

export type AssetPriceResponse = {
    asset_id: string
    usd_value: string
}

export type AssetPrice = {
    assetId: string
    fiatPrice: Decimal
}

export type AssetPrices = Map<string, AssetPrice>

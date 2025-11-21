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

import type {
    Account,
    AssetLabel,
    Collectible,
    SimpleCollectible,
} from '../../api/index'

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

export type PeraCollectible = Collectible | SimpleCollectible

export type PeraAsset = {
    asset_id: number
    fraction_decimals: number
    total: string
    is_deleted: boolean
    verification_tier: PeraAssetVerificationTier
    creator: Account
    category: number | null
    name?: string
    readonly logo?: string | null
    unit_name?: string
    usd_value?: string | null
    readonly is_verified?: boolean
    readonly explorer_url?: string
    collectible?: PeraCollectible
    type?: PeraAssetType
    readonly labels?: AssetLabel[]
    project_url?: string
    project_name?: string
    readonly logo_svg?: string | null
    discord_url?: string
    telegram_url?: string
    twitter_username?: string
    description?: string
    url?: string
    readonly total_supply?: string
    last_24_hours_algo_price_change_percentage?: number | null
    readonly available_on_discover_mobile?: string
}

export const ALGO_ASSET: PeraAsset = {
    asset_id: 0,
    fraction_decimals: 6,
    unit_name: 'ALGO',
    name: 'Algo',
    verification_tier: 'verified',
    last_24_hours_algo_price_change_percentage: 0,
    total: '10000000000000000000', //10,000 T microalgos
    is_deleted: false,
    creator: {
        address: '',
    },
    is_verified: true,
    category: 0,
}

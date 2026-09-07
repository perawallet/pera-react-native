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
import {
    type Network,
    type PeraBackedNetwork,
    isPeraBackedNetwork,
} from '@perawallet/wallet-core-config'

import type { PeraCollectible } from './collectibles'
import {
    ALGO_ASSET_ID,
    ALGO_ASSET_NAME,
    type Nullable,
} from '@perawallet/wallet-core-shared'

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

export type { PeraCollectible } from './collectibles'

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export type PeraAssetLabel = {
    //TODO: Add asset label type
}

export type CreatorAccount = {
    address: string
}

export type MinimalAsset = {
    assetId: string
    name?: string
    unitName?: string
    decimals?: number
}

// The minimal shape any asset-row UI needs to render. `PeraAsset` satisfies this
// (its `peraMetadata: PeraAssetMetadata` is assignable to `Partial<…>`), and search
// results are mapped onto it by `transformSearchResult`.
export type DisplayableAsset = MinimalAsset & {
    peraMetadata?: Partial<PeraAssetMetadata>
}

export type PeraAsset = MinimalAsset & {
    decimals: number
    creator: CreatorAccount
    /** Total supply in base units (smallest indivisible unit of the asset) */
    totalSupply: Decimal
    metadata?: string
    url?: string
    peraMetadata?: PeraAssetMetadata
}

export const DEFAULT_ASSET_METADATA: PeraAssetMetadata = {
    isDeleted: false,
    verificationTier: PeraAssetVerificationTier.unverified,
    isFavorited: false,
    isPriceAlertEnabled: false,
}

export const DEFAULT_ASSET_VALUES: PeraAsset = {
    assetId: '',
    decimals: 0,
    creator: {
        address: '',
    },
    totalSupply: new Decimal(0),
    peraMetadata: DEFAULT_ASSET_METADATA,
}

export type PeraAssetMetadata = {
    isDeleted: boolean
    verificationTier: PeraAssetVerificationTier
    category?: number //TODO: Add category type
    logo?: Nullable<string>
    readonly isVerified?: boolean
    readonly explorerUrl?: string
    collectible?: PeraCollectible
    type?: PeraAssetType
    readonly labels?: PeraAssetLabel[]
    projectUrl?: string
    projectName?: string
    readonly logoSvg?: Nullable<string>
    discordUrl?: string
    telegramUrl?: string
    twitterUsername?: string
    description?: string
    readonly availableOnDiscoverMobile?: string
    isFrozen?: boolean
    canClawback?: boolean
    isFavorited?: boolean
    isPriceAlertEnabled?: boolean
}

export const KNOWN_ASSET_IDS = {
    USDC: { mainnet: '31566704', testnet: '10458941' },
} as const satisfies Record<string, Record<PeraBackedNetwork, string>>

export type KnownAssetKey = keyof typeof KNOWN_ASSET_IDS

/**
 * The network's id for a well-known asset, or `null` where there is no known
 * id.
 *
 * Returned `null` rather than TestNet's id: that id does not identify the same
 * asset on another chain. Every consumer is a Pera-backed feature that is
 * already unavailable on those networks, so this changes nothing user-visible
 * — it just stops a wrong id circulating.
 */
export const getKnownAssetId = (
    key: KnownAssetKey,
    network: Network,
): Nullable<string> =>
    isPeraBackedNetwork(network) ? KNOWN_ASSET_IDS[key][network] : null

export const ALGO_ASSET: PeraAsset = {
    assetId: ALGO_ASSET_ID,
    name: 'Algo',
    unitName: ALGO_ASSET_NAME,
    decimals: 6,
    totalSupply: new Decimal('10000000000000000'), // 10B ALGO in microAlgos
    creator: {
        address: '',
    },
    peraMetadata: {
        ...DEFAULT_ASSET_METADATA,
        verificationTier: PeraAssetVerificationTier.verified,
        type: PeraAssetType.algo,
    },
}

export type AssetPrice = {
    assetId: string
    usdPrice: Decimal
}

export type AssetPrices = Map<string, AssetPrice>

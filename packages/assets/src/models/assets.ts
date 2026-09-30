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
    scopeForLegacyNetwork,
    toScopeKey,
    type ChainScope,
    type ChainScopeKey,
} from '@perawallet/wallet-core-chain-contract'
import { type Network } from '@perawallet/wallet-core-config'

import type { PeraCollectible } from './collectibles'
import type { Nullable } from '@perawallet/wallet-core-shared'

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

const legacyScopeKey = (network: Network): ChainScopeKey =>
    toScopeKey(scopeForLegacyNetwork(network))

/**
 * Every declared network has an explicit entry, `null` included, so a network
 * added to a chain without deciding its asset ids shows up as a missing key.
 */
export const KNOWN_ASSET_IDS: {
    readonly USDC: ReadonlyMap<ChainScopeKey, Nullable<string>>
} = {
    USDC: new Map([
        [legacyScopeKey('mainnet'), '31566704'],
        [legacyScopeKey('testnet'), '10458941'],
        [legacyScopeKey('betanet'), null],
    ]),
}

export type KnownAssetKey = keyof typeof KNOWN_ASSET_IDS

/**
 * The scope's id for a well-known asset, or `null` where there is no known
 * id, including a scope that is not a valid scope key.
 *
 * Returned `null` rather than TestNet's id: that id does not identify the same
 * asset on another chain. Every consumer is a Pera-backed feature that is
 * already unavailable on those networks, so this changes nothing user-visible
 * — it just stops a wrong id circulating.
 */
export const getKnownAssetId = (
    key: KnownAssetKey,
    scope: ChainScope,
): Nullable<string> => {
    let scopeKey: ChainScopeKey
    try {
        scopeKey = toScopeKey(scope)
    } catch {
        return null
    }
    return KNOWN_ASSET_IDS[key].get(scopeKey) ?? null
}

export type AlgorandAssetPrice = {
    assetId: string
    usdPrice: Decimal
}

export type AssetPrices = Map<string, AlgorandAssetPrice>

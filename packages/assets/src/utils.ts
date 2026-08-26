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
import { formatNumber } from '@perawallet/wallet-core-shared'

import { type MinimalAsset, type PeraAsset, PeraAssetType } from './models'

/** Base units -> display units. Asset-aware wrapper over `baseUnitsToDisplayUnits`. */
export const toWholeUnits = (
    value: Decimal | number | bigint,
    asset: PeraAsset,
): Decimal => {
    return new Decimal(value.toString()).div(Decimal.pow(10, asset.decimals))
}

/** Display units -> base units. Asset-aware wrapper over `displayUnitsToBaseUnits`. */
export const toDecimalUnits = (
    value: Decimal | number | bigint,
    asset: PeraAsset,
): Decimal => {
    return new Decimal(value.toString()).mul(Decimal.pow(10, asset.decimals))
}

/** Pure (non-fractional) NFT per ARC-3: 1 total supply, 0 decimals. */
export const isPureNft = (
    asset: Pick<PeraAsset, 'totalSupply' | 'decimals'>,
): boolean => {
    return asset.totalSupply.eq(1) && asset.decimals === 0
}

/**
 * Whether an asset is shaped like an NFT. Used only to decide whether
 * re-asking the backend about an unclassified asset is worthwhile — never as a
 * classification, since `isCollectible` is the only answer that counts. A
 * false positive costs one request; a false negative falls back to the long
 * cache TTL.
 *
 * NFTs are indivisible, whether one-of-one or an edition of many. The lone
 * exception is ARC-3's fractional NFT, which holds exactly 10^decimals units.
 */
export const hasNftShape = (
    asset: Pick<PeraAsset, 'totalSupply' | 'decimals'>,
): boolean =>
    asset.decimals === 0 ||
    asset.totalSupply.eq(Decimal.pow(10, asset.decimals))

/** Backend-driven classification, via the `type` field in Pera metadata. */
export const isCollectible = (asset: PeraAsset): boolean => {
    return asset.peraMetadata?.type === PeraAssetType.collectible
}

/**
 * Pure NFTs format to an empty string — their quantity is implicit.
 * Fractional NFTs get an "x" prefix, e.g. "x0.5".
 */
export const formatCollectibleAmount = (
    amount: Decimal,
    asset: PeraAsset,
): string => {
    if (isPureNft(asset)) {
        return ''
    }
    return `x${amount.toString()}`
}

/** Base units in, e.g. "1,234.56 ALGO" out. */
export const formatAssetAmount = (
    amount: Decimal | string,
    asset: Pick<MinimalAsset, 'decimals' | 'unitName'>,
): string => {
    const decimals = asset.decimals ?? 0
    const display = new Decimal(amount.toString()).div(
        Decimal.pow(10, decimals),
    )
    const { sign, integer, fraction } = formatNumber(
        display,
        decimals,
        undefined,
        2,
    )
    return `${sign}${integer}${fraction} ${asset.unitName ?? ''}`.trim()
}

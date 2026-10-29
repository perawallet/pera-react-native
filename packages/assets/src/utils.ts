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

import type { Decimal } from 'decimal.js'
import {
    baseUnitsToDisplayUnits,
    displayUnitsToBaseUnits,
    formatNumber,
    resolveAssetDisplayPrecision,
    roundAssetAmountForDisplay,
} from '@perawallet/wallet-core-shared'

import { type MinimalAsset, type PeraAsset, PeraAssetType } from './models'

/** Base units -> display units. Asset-aware wrapper over `baseUnitsToDisplayUnits`. */
export const toWholeUnits = (
    value: Decimal | number | bigint,
    asset: PeraAsset,
): Decimal => {
    return baseUnitsToDisplayUnits(value, asset.decimals)
}

/** Display units -> base units. Asset-aware wrapper over `displayUnitsToBaseUnits`. */
export const toDecimalUnits = (
    value: Decimal | number | bigint,
    asset: PeraAsset,
): Decimal => {
    return displayUnitsToBaseUnits(value, asset.decimals)
}

/** Backend-driven classification, via the `type` field in Pera metadata. */
export const isCollectible = (asset: PeraAsset): boolean => {
    return asset.peraMetadata?.type === PeraAssetType.collectible
}

/** A collectible whose chain says a holding can only ever be 1. */
export const isUniqueCollectible = (asset: PeraAsset): boolean =>
    isCollectible(asset) && asset.peraMetadata?.isUnique === true

/**
 * Unique collectibles format to an empty string — their quantity is implicit.
 * Others get an "x" prefix, e.g. "x0.5".
 */
export const formatCollectibleAmount = (
    amount: Decimal,
    asset: PeraAsset,
): string => {
    if (isUniqueCollectible(asset)) {
        return ''
    }
    return `x${amount.toString()}`
}

/** Base units in, e.g. "1,234.56 ALGO" out. */
export const formatAssetAmount = (
    amount: Decimal,
    asset: Pick<MinimalAsset, 'decimals' | 'unitName'>,
): string => {
    const decimals = asset.decimals ?? 0
    const display = roundAssetAmountForDisplay(
        baseUnitsToDisplayUnits(amount, decimals),
        decimals,
    )
    const { sign, integer, fraction } = formatNumber(
        display,
        resolveAssetDisplayPrecision(display, decimals),
        undefined,
        2,
    )
    return `${sign}${integer}${fraction} ${asset.unitName ?? ''}`.trim()
}

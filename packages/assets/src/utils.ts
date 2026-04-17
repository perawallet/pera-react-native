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

import { Decimal } from 'decimal.js'
import { formatNumber } from '@perawallet/wallet-core-shared'

import { ALGO_ASSET_ID, PeraAsset, PeraAssetType } from './models'

/**
 * Checks whether an asset id refers to the native ALGO asset.
 * Accepts both string and number ids since different data sources
 * (Pera API vs DEX responses) represent the id in different shapes.
 *
 * @param assetId - The asset id to check
 * @returns true if the asset id is ALGO
 */
export const isAlgoAsset = (assetId: string | number): boolean =>
    String(assetId) === ALGO_ASSET_ID

/**
 * Converts an amount from base units to display units for a given asset.
 * Uses the same logic as `baseUnitsToDisplayUnits` from `@perawallet/wallet-core-blockchain`.
 *
 * @param value - The amount in base units (smallest indivisible unit)
 * @param asset - The asset definition containing decimal places
 * @returns The amount in display units as a Decimal
 */
export const toWholeUnits = (
    value: Decimal | number | bigint,
    asset: PeraAsset,
): Decimal => {
    return new Decimal(value.toString()).div(Decimal.pow(10, asset.decimals))
}

/**
 * Converts an amount from display units to base units for a given asset.
 * Uses the same logic as `displayUnitsToBaseUnits` from `@perawallet/wallet-core-blockchain`.
 *
 * @param value - The amount in display units (human-readable)
 * @param asset - The asset definition containing decimal places
 * @returns The amount in base units as a Decimal
 */
export const toDecimalUnits = (
    value: Decimal | number | bigint,
    asset: PeraAsset,
): Decimal => {
    return new Decimal(value.toString()).mul(Decimal.pow(10, asset.decimals))
}

/**
 * Checks whether an asset is a pure NFT per ARC-3 spec.
 * A pure NFT has exactly 1 total supply and 0 decimals.
 *
 * @param asset - The asset to check
 * @returns true if the asset is a pure (non-fractional) NFT
 */
export const isPureNft = (asset: PeraAsset): boolean => {
    return asset.totalSupply.eq(1) && asset.decimals === 0
}

/**
 * Checks whether an asset is classified as a collectible/NFT.
 * Classification is backend-driven via the `type` field in Pera metadata.
 *
 * @param asset - The asset to check
 * @returns true if the asset is a collectible
 */
export const isCollectible = (asset: PeraAsset): boolean => {
    return asset.peraMetadata?.type === PeraAssetType.collectible
}

/**
 * Formats a collectible amount for display.
 * Pure NFTs (totalSupply=1, decimals=0) return an empty string since
 * the quantity is implicit. Fractional NFTs return the amount with an
 * "x" prefix (e.g., "x0.5").
 *
 * @param amount - The amount in display units
 * @param asset - The asset to format for
 * @returns Formatted amount string, or empty string for pure NFTs
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

/**
 * Formats an asset amount from base units into a human-readable string
 * with the asset's unit name appended.
 *
 * @param amount - The amount in base units
 * @param asset - The asset definition (needs decimals and unitName)
 * @returns Formatted string, e.g. "1,234.56 ALGO"
 */
export const formatAssetAmount = (
    amount: Decimal | string,
    asset: { decimals?: number; unitName?: string },
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

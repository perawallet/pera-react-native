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

import { PeraAsset } from './models'

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

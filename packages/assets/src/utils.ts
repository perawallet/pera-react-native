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

import { PeraAsset } from './models'
import Decimal from 'decimal.js'

/**
 * Converts an amount represented as a decimal value to the amount in units (i.e. milli algos to algos)
 *
 * @param value The amount to convert in decimal units (e.g. milli algos)
 * @param asset The asset to convert to units for
 * @returns The amount in whole units (e.g. algos)
 */
export const toWholeUnits = (
    value: Decimal | number | bigint,
    asset: PeraAsset,
) => {
    return Decimal(typeof value === 'number' ? value : value.toString()).div(
        Decimal(10).pow(asset.decimals),
    )
}

/**
 * Converts an amount represented as a unit value to the amount in decimal value (i.e. algos to milli algos)
 *
 * @param value The amount to convert in whole units (e.g. algos)
 * @param asset The asset to convert to decimal value for
 * @returns The amount in decimal units (e.g. milli algos)
 */
export const toDecimalUnits = (
    value: Decimal | number | bigint,
    asset: PeraAsset,
) => {
    return Decimal(typeof value === 'number' ? value : value.toString()).mul(
        Decimal(10).pow(asset.decimals),
    )
}

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

import { ALGO_ASSET_ID, ALGO_ASSET_NAME } from '../constants'
import type { Nullable } from './types'

/**
 * Whether an asset id refers to the native ALGO asset.
 *
 * Accepts string, number, and bigint ids since different layers represent the
 * id in different shapes (Pera API strings, DEX numbers, AlgoKit/transaction
 * `bigint`s). Comparing a raw `=== ALGO_ASSET_ID` / `=== 0n` would silently miss
 * the other shapes, so always prefer this. A missing id (`null`/`undefined`)
 * is treated as not-ALGO.
 */
export const isAlgoAssetId = (
    assetId: string | number | bigint | null | undefined,
): boolean => String(assetId) === ALGO_ASSET_ID

/**
 * Whether a value (currency id, asset unit name, or ramp-token id/symbol) is the
 * native ALGO ticker. The name-based counterpart to {@link isAlgoAssetId}.
 *
 * Only for values from trusted sources (settings, first-party backends, ramp
 * providers). Never decide identity from an on-chain unit name — an ASA can
 * name itself "ALGO"; use {@link isAlgoAssetId} on the asset id instead.
 */
export const isAlgoAssetName = (value: string): boolean =>
    value === ALGO_ASSET_NAME

/**
 * Asset id for a *trusted* display-currency code (a settings/backend value,
 * never an on-chain unit name): ALGO's id when the code is the ALGO ticker,
 * else null (a fiat code). Bridges name-keyed trusted sources into the
 * id-keyed identity that amount renderers require.
 */
export const displayCurrencyToAssetId = (code: string): Nullable<string> =>
    isAlgoAssetName(code) ? ALGO_ASSET_ID : null

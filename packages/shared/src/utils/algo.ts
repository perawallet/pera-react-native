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

import { ALGO_ASSET_ID, ALGO_ASSET_NAME } from '../constants'

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
 */
export const isAlgoAssetName = (value: string): boolean =>
    value === ALGO_ASSET_NAME

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

import { ALGO_ASSET_NAME, isAlgoAssetId } from '@perawallet/wallet-core-shared'

/**
 * Deliberately not `ALGO_ASSET.decimals` from wallet-core-assets: that import
 * pulls react-native-mmkv into this module, and it is reached from the
 * transactions DB layer.
 */
export const ALGO_DECIMALS = 6

/** Unit name and decimals as an amount renderer needs them. */
export type AssetDisplayFacts = {
    unitName: string
    decimals: number
}

/**
 * ALGO's ticker and decimals are chain invariants, so they outrank whatever a
 * response or a cached row claims. The Pera backend substitutes an
 * `asset(<id>)` placeholder with 0 decimals whenever its own asset enrichment
 * fails, which renders `3,000 asset(0)` where `0.003 ALGO` belongs; a
 * placeholder for any other id has to stand, since only the backend knows
 * that asset's real facts.
 */
export const resolveAssetFacts = (
    // Same id shapes `isAlgoAssetId` accepts: rows persisted before the
    // uint64-string migration still hold the id as a number.
    assetId: string | number | bigint | null | undefined,
    facts: AssetDisplayFacts,
): AssetDisplayFacts =>
    isAlgoAssetId(assetId)
        ? { unitName: ALGO_ASSET_NAME, decimals: ALGO_DECIMALS }
        : facts

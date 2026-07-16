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

/**
 * The native Algo asset's on-chain id: `'0'`.
 *
 * Distinct from {@link ALGO_ASSET_NAME} (`'ALGO'`, the ticker). Defined in
 * `shared` so the single source of truth is reachable from every package without
 * circular dependencies.
 */
export const ALGO_ASSET_ID = '0'

/**
 * The canonical identifier for the native Algo asset: its ticker `'ALGO'`.
 *
 * Used wherever Algo is named as a string — asset unit name, preferred-currency
 * id, and onramp ramp-token id all collapse to this one value. Defined in
 * `shared` (the package every domain depends on) so a single source of truth is
 * reachable everywhere without circular dependencies.
 *
 * Note: distinct from {@link ALGO_ASSET_ID} (`'0'`), the on-chain numeric asset id.
 */
export const ALGO_ASSET_NAME = 'ALGO'

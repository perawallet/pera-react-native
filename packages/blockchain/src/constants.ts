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

/**
 * Base minimum balance for any account, in µAlgo (0.1 ALGO).
 *
 * Fallback only — do not read directly at runtime; use `useMinimumFeeConfig`,
 * which sources the value from remote config.
 */
export const FALLBACK_BASE_ACCOUNT_MBR = 100_000n

/**
 * Additional minimum balance per opted-in asset, in µAlgo (0.1 ALGO).
 *
 * Fallback only — do not read directly at runtime; use `useMinimumFeeConfig`,
 * which sources the value from remote config.
 */
export const FALLBACK_ASSET_MBR = 100_000n

/**
 * Minimum transaction fee, in µAlgo (0.001 ALGO).
 *
 * Fallback only — do not read directly at runtime; use `useMinimumFeeConfig`,
 * which sources the value from remote config.
 */
export const FALLBACK_MIN_TXN_FEE = 1000n

/** @deprecated Use `useMinimumFeeConfig` (remote config); removed in PQ-016. */
export const BASE_ACCOUNT_MBR = FALLBACK_BASE_ACCOUNT_MBR

/** @deprecated Use `useMinimumFeeConfig` (remote config); removed in PQ-016. */
export const ASSET_MBR = FALLBACK_ASSET_MBR

/** @deprecated Use `useMinimumFeeConfig` (remote config); removed in PQ-016. */
export const MIN_TXN_FEE = FALLBACK_MIN_TXN_FEE

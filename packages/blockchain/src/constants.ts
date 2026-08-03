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

/** µAlgo. Fallback only — at runtime use `useMinimumFeeConfig` (remote config). */
export const FALLBACK_BASE_ACCOUNT_MBR = 100_000n

/** Per opted-in asset, µAlgo. Fallback only — see `useMinimumFeeConfig`. */
export const FALLBACK_ASSET_MBR = 100_000n

/** µAlgo. Fallback only — see `useMinimumFeeConfig`. */
export const FALLBACK_MIN_TXN_FEE = 1000n

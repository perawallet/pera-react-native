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
 * Without an on-chain probe, include derivation indices 0 through this cap
 * (inclusive) — presence can't be determined, so the scan stays shallow.
 */
export const DEFAULT_MAX_ACCOUNT_SCAN_GAP = 2

/**
 * With an on-chain probe, stop after this many consecutive indices with no
 * on-chain presence. Chosen to match HD discovery's current account gap
 * limit (`ACCOUNT_GAP_LIMIT` in `packages/accounts/src/account-discovery.ts`
 * — a private constant, so the two are NOT mechanically linked) so a Ledger
 * migrator's funded accounts are found as deep as an HD import would look.
 */
export const DEFAULT_ONCHAIN_ACCOUNT_SCAN_GAP = 5

/**
 * Hard ceiling on the highest derivation index a probed scan will visit,
 * regardless of how many funded accounts keep resetting the gap. Every
 * extra index costs one silent `getAddress` device call plus one network
 * lookup, so this bounds worst-case scan time on a device with dozens of
 * funded accounts; "Find another account" continues past it on demand.
 */
export const DEFAULT_MAX_ACCOUNT_SCAN_INDEX = 32

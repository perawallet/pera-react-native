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
 * With an on-chain probe, stop after this many consecutive empty indices.
 * Matches HD discovery's `ACCOUNT_GAP_LIMIT` (private, so NOT mechanically
 * linked) so a Ledger migrator's accounts surface as deep as an HD import's.
 */
export const DEFAULT_ONCHAIN_ACCOUNT_SCAN_GAP = 5

/**
 * Ceiling regardless of how many funded accounts keep resetting the gap —
 * every extra index costs a device call plus a network lookup. "Find another
 * account" continues past it on demand.
 */
export const DEFAULT_MAX_ACCOUNT_SCAN_INDEX = 32

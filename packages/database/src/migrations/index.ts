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

import type { MigrationConfig } from '../migrator'

import m0000 from './0000_initial.sql?raw'
import m0001 from './0001_add_balance_impacts.sql?raw'
import m0002 from './0002_add_close_amount.sql?raw'
import m0003 from './0003_add_is_frozen.sql?raw'
import m0004 from './0004_add_asset_price_misses.sql?raw'
import m0005 from './0005_add_submission_attempts.sql?raw'

// Rows cached before the close_amount column heal in place via the chain
// backfill (packages/transactions sync/close-amount-backfill.ts) — no
// cache-wiping migration needed.
const migrations: MigrationConfig = {
    '0000_initial': m0000,
    '0001_add_balance_impacts': m0001,
    '0002_add_close_amount': m0002,
    // Holdings rows default to unfrozen and heal on the next account sync.
    '0003_add_is_frozen': m0003,
    // Durable "no price returned" markers so the price syncer can defer
    // retries across any portfolio size (replaces a capped in-memory map).
    '0004_add_asset_price_misses': m0004,
    // Submission ledger (PERA-4588): one row per broadcast attempt, written
    // before the POST and resolved by confirmation / rejection / reconciler.
    '0005_add_submission_attempts': m0005,
}

export default migrations

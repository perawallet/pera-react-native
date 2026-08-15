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

// Rows cached before the close_amount column heal in place via the chain
// backfill (packages/transactions sync/close-amount-backfill.ts) — no
// cache-wiping migration needed.
const migrations: MigrationConfig = {
    '0000_initial': m0000,
    '0001_add_balance_impacts': m0001,
    '0002_add_close_amount': m0002,
}

export default migrations

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
import m0003 from './0003_resync_transaction_history.sql?raw'

const migrations: MigrationConfig = {
    '0000_initial': m0000,
    '0001_add_balance_impacts': m0001,
    '0002_add_close_amount': m0002,
    // Rows cached before the close_amount column (and the balance-impact
    // derivation) permanently show 0 for close-outs — the syncer only
    // fetches forward from the newest cached round, so they never heal.
    // The tables are a cache of remote history; wipe and let it resync.
    '0003_resync_transaction_history': m0003,
}

export default migrations

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

import type { MigrationConfig } from '../migrator'

import m0000 from './0000_busy_hemingway.sql?raw'
import m0001 from './0001_sync_tables.sql?raw'
import m0002 from './0002_application_id_to_text.sql?raw'
import journal from './meta/_journal.json'

const migrations: MigrationConfig = {
    journal,
    migrations: {
        '0000_busy_hemingway': m0000,
        '0001_sync_tables': m0001,
        '0002_application_id_to_text': m0002,
    },
}

export default migrations

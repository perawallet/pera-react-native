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

import BetterSqlite3 from 'better-sqlite3'
import { runDatabaseContract } from '../../../../platform/src/test-utils/database-contract'
import { createChromeFake } from '../../test-utils/chrome'
import {
    setActiveDatabaseHost,
    startDatabaseHost,
    type SqlExecutor,
} from '../../database/host'
import { ChromeDatabaseService } from '../database'

// Mirrors apps/browser's sqlite-wasm db-worker: `[]` for run, positional
// row arrays for everything else.
const createSqliteExecutor = (sqlite: BetterSqlite3.Database): SqlExecutor => ({
    async exec(_name, sql, params, method) {
        const bind = params.map(value => (value === undefined ? null : value))
        const statement = sqlite.prepare(sql)
        if (method === 'run') {
            statement.run(...bind)
            return []
        }
        return statement.raw().all(...bind) as unknown[][]
    },
    async deleteDatabase() {},
})

const createDatabase = async (isProxied: boolean) => {
    globalThis.chrome = createChromeFake().chrome
    const sqlite = new BetterSqlite3(':memory:')
    const host = startDatabaseHost(createSqliteExecutor(sqlite))
    host.setReady()
    // Without an active host, the service proxies every statement over
    // chrome.runtime messaging, as every non-offscreen context does.
    if (isProxied) setActiveDatabaseHost(null)

    const db = await new ChromeDatabaseService().getDatabase('pera.db')

    return {
        db,
        teardown: () => {
            setActiveDatabaseHost(null)
            sqlite.close()
        },
    }
}

runDatabaseContract('ChromeDatabaseService (proxied over messaging)', () =>
    createDatabase(true),
)

runDatabaseContract('ChromeDatabaseService (offscreen host, local)', () =>
    createDatabase(false),
)

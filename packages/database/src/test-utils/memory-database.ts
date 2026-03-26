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

import BetterSqlite3 from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/sqlite-proxy'
import type { Database } from '../database'

type TestDatabase = {
    db: Database
    teardown: () => void
}

export const createTestDatabase = (): TestDatabase => {
    const sqlite = new BetterSqlite3(':memory:')

    const db: Database = drizzle(async (sql, params, method) => {
        if (method === 'run') {
            sqlite.prepare(sql).run(...params)
            return { rows: [] }
        }

        const rows = sqlite.prepare(sql).all(...params) as Record<
            string,
            unknown
        >[]

        return { rows: rows.map(row => Object.values(row)) }
    })

    return {
        db,
        teardown: () => {
            sqlite.close()
        },
    }
}

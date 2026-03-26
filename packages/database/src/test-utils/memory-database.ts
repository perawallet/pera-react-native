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
import type { Database } from '../database'
import type { DatabaseBindValue } from '@perawallet/wallet-extension-platform'

type TestDatabase = {
    db: Database
    teardown: () => void
}

export const createTestDatabase = (): TestDatabase => {
    const sqlite = new BetterSqlite3(':memory:')

    const db: Database = {
        async runAsync(
            sql: string,
            params?: DatabaseBindValue[],
        ): Promise<void> {
            sqlite.prepare(sql).run(...(params ?? []))
        },
        async getAllAsync<T>(
            sql: string,
            params?: DatabaseBindValue[],
        ): Promise<T[]> {
            return sqlite.prepare(sql).all(...(params ?? [])) as T[]
        },
        async getFirstAsync<T>(
            sql: string,
            params?: DatabaseBindValue[],
        ): Promise<T | null> {
            return (sqlite.prepare(sql).get(...(params ?? [])) as T) ?? null
        },
        async withTransactionAsync(fn: () => Promise<void>): Promise<void> {
            sqlite.exec('BEGIN')
            try {
                await fn()
                sqlite.exec('COMMIT')
            } catch (error) {
                sqlite.exec('ROLLBACK')
                throw error
            }
        },
    }

    return {
        db,
        teardown: () => {
            sqlite.close()
        },
    }
}

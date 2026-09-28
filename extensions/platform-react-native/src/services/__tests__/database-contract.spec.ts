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

import { vi } from 'vitest'
import BetterSqlite3 from 'better-sqlite3'

const { databases } = vi.hoisted(() => ({
    databases: new Map<string, BetterSqlite3.Database>(),
}))

// expo-sqlite over better-sqlite3, keyed by name so the write and read
// connections share one in-memory database the way two WAL connections share
// one file. getAllAsync resolves keyed objects, as expo-sqlite's does.
vi.mock('expo-sqlite', () => {
    const connect = (name: string) => {
        let sqlite = databases.get(name)
        if (!sqlite) {
            sqlite = new BetterSqlite3(':memory:')
            databases.set(name, sqlite)
        }
        const db = sqlite
        return {
            execAsync: async (sql: string) => void db.exec(sql),
            runAsync: async (sql: string, params: unknown[]) =>
                void db.prepare(sql).run(...params),
            getAllAsync: async (sql: string, params: unknown[]) =>
                db.prepare(sql).all(...params),
            closeAsync: async () => {},
        }
    }
    return {
        openDatabaseAsync: async (name: string) => connect(name),
        deleteDatabaseAsync: async () => {},
    }
})

import { runDatabaseContract } from '../../../../platform/src/test-utils/database-contract'
import { RNDatabaseService } from '../database'

runDatabaseContract('RNDatabaseService', async () => {
    const service = new RNDatabaseService()
    const db = await service.getDatabase('pera.db')

    return {
        db,
        teardown: async () => {
            await service.close('pera.db')
            databases.get('pera.db')?.close()
            databases.clear()
        },
    }
})

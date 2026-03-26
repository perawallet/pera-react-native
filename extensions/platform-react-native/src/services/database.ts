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

import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite'
import { drizzle } from 'drizzle-orm/sqlite-proxy'
import type {
    Database,
    DatabaseService,
    DatabaseDriver,
} from '@perawallet/wallet-extension-platform'

class ExpoSQLiteDatabaseDriver implements DatabaseDriver {
    constructor(readonly driver: SQLiteDatabase) {}
}

function createExpoSQLiteProxy(client: SQLiteDatabase): Database {
    return drizzle(async (sql, params, method) => {
        if (method === 'run') {
            await client.runAsync(sql, params)
            return { rows: [] }
        }

        const rows = await client.getAllAsync(sql, params)

        return {
            rows: rows.map(row =>
                Object.values(row as Record<string, unknown>),
            ),
        }
    })
}

export class RNDatabaseService implements DatabaseService {
    private databases = new Map<string, SQLiteDatabase>()

    async open(name: string): Promise<DatabaseDriver> {
        const db = await this.getOrOpen(name)

        return new ExpoSQLiteDatabaseDriver(db)
    }

    async getDatabase(name: string): Promise<Database> {
        const db = await this.getOrOpen(name)

        return createExpoSQLiteProxy(db)
    }

    async close(name: string): Promise<void> {
        const db = this.databases.get(name)

        if (db) {
            await db.closeAsync()
            this.databases.delete(name)
        }
    }

    private async getOrOpen(name: string): Promise<SQLiteDatabase> {
        let db = this.databases.get(name)

        if (!db) {
            db = await openDatabaseAsync(name)
            this.databases.set(name, db)
        }

        return db
    }
}

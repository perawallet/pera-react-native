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
import type {
    Database,
    DatabaseBindValue,
    DatabaseService,
    DatabaseDriver,
} from '@perawallet/wallet-extension-platform'

class ExpoSQLiteDatabaseDriver implements DatabaseDriver {
    constructor(readonly driver: SQLiteDatabase) {}
}

class ExpoSQLiteDatabase implements Database {
    constructor(private readonly db: SQLiteDatabase) {}

    async runAsync(sql: string, params?: DatabaseBindValue[]): Promise<void> {
        await this.db.runAsync(sql, params ?? [])
    }

    async getAllAsync<T>(
        sql: string,
        params?: DatabaseBindValue[],
    ): Promise<T[]> {
        return this.db.getAllAsync<T>(sql, params ?? [])
    }

    async getFirstAsync<T>(
        sql: string,
        params?: DatabaseBindValue[],
    ): Promise<T | null> {
        return this.db.getFirstAsync<T>(sql, params ?? [])
    }

    async withTransactionAsync(fn: () => Promise<void>): Promise<void> {
        await this.db.withTransactionAsync(fn)
    }
}

export class RNDatabaseService implements DatabaseService {
    private databases = new Map<string, SQLiteDatabase>()

    async open(name: string): Promise<DatabaseDriver> {
        const db = await this.getOrOpen(name)

        return new ExpoSQLiteDatabaseDriver(db)
    }

    async getDatabase(name: string): Promise<Database> {
        const db = await this.getOrOpen(name)

        return new ExpoSQLiteDatabase(db)
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

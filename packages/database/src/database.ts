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

import type {
    Database,
    DatabaseService,
} from '@perawallet/wallet-extension-platform'
import { runMigrations } from './migrator'
import migrations from './migrations'

export type { Database }

const DATABASE_NAME = 'pera.db'

let instance: Database | null = null

export const initializeDatabase = async (
    database: DatabaseService,
): Promise<void> => {
    const db = await database.getDatabase(DATABASE_NAME)

    instance = db
    await runMigrations(db, migrations)
}

export const getDatabase = (): Database => {
    if (instance === null) {
        throw new Error(
            'Database not initialized. Call initializeDatabase() during app bootstrap.',
        )
    }

    return instance
}

export const resetDatabase = (): void => {
    instance = null
}

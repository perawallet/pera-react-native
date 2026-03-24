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

import type { DrizzleDatabase } from './connection'

export type MigrationConfig = {
    journal: {
        entries: Array<{ idx: number; when: number; tag: string }>
    }
    migrations: Record<string, string>
}

export type MigratorFn = (
    db: DrizzleDatabase,
    migrations: MigrationConfig,
) => Promise<void>

export const runMigrations = async (
    db: DrizzleDatabase,
    migrator: MigratorFn,
    migrations: MigrationConfig,
): Promise<void> => {
    await migrator(db, migrations)
}

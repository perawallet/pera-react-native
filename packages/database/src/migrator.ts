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

import type { Database } from '@perawallet/wallet-extension-platform'

export type MigrationConfig = {
    journal: {
        entries: Array<{ idx: number; when: number; tag: string }>
    }
    migrations: Record<string, string>
}

export const runMigrations = async (
    db: Database,
    migrations: MigrationConfig,
): Promise<void> => {
    await db.runAsync(`
        CREATE TABLE IF NOT EXISTS __drizzle_migrations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tag TEXT NOT NULL UNIQUE,
            created_at INTEGER NOT NULL
        )
    `)

    const applied = await db.getAllAsync<{ tag: string }>(
        `SELECT tag FROM __drizzle_migrations ORDER BY id`,
    )

    const appliedSet = new Set(applied.map((row: { tag: string }) => row.tag))

    const sorted = [...migrations.journal.entries].sort((a, b) => a.idx - b.idx)

    for (const entry of sorted) {
        if (appliedSet.has(entry.tag)) {
            continue
        }

        const migrationSql = migrations.migrations[entry.tag]

        if (!migrationSql) {
            throw new Error(`Migration SQL not found for tag: ${entry.tag}`)
        }

        const statements = migrationSql
            .split('--> statement-breakpoint')
            .map(s => s.trim())
            .filter(s => s.length > 0)

        for (const statement of statements) {
            await db.runAsync(statement)
        }

        await db.runAsync(
            `INSERT INTO __drizzle_migrations (tag, created_at) VALUES (?, ?)`,
            [entry.tag, Date.now()],
        )
    }
}

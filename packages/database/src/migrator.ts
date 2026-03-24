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

import { sql } from 'drizzle-orm'
import type { DrizzleDatabase } from './connection'

export type MigrationConfig = {
    journal: {
        entries: Array<{ idx: number; when: number; tag: string }>
    }
    migrations: Record<string, string>
}

export const runMigrations = (
    db: DrizzleDatabase,
    migrations: MigrationConfig,
): void => {
    db.run(sql`
        CREATE TABLE IF NOT EXISTS __drizzle_migrations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tag TEXT NOT NULL UNIQUE,
            created_at INTEGER NOT NULL
        )
    `)

    const applied = db
        .all<{ tag: string }>(
            sql`SELECT tag FROM __drizzle_migrations ORDER BY id`,
        )
        .map(row => row.tag)

    const appliedSet = new Set(applied)

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
            db.run(sql.raw(statement))
        }

        db.run(
            sql`INSERT INTO __drizzle_migrations (tag, created_at) VALUES (${entry.tag}, ${Date.now()})`,
        )
    }
}

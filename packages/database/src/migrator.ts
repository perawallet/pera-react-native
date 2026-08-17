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

import { sql } from 'drizzle-orm'
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'
import type { Database } from '@perawallet/wallet-extension-platform'

export type MigrationConfig = Record<string, string>

const drizzleMigrations = sqliteTable('__drizzle_migrations', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    tag: text('tag').notNull().unique(),
    createdAt: integer('created_at').notNull(),
})

export const runMigrations = async (
    db: Database,
    migrations: MigrationConfig,
): Promise<void> => {
    await db.run(sql`
        CREATE TABLE IF NOT EXISTS __drizzle_migrations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tag TEXT NOT NULL UNIQUE,
            created_at INTEGER NOT NULL
        )
    `)

    const applied = await db
        .select({ tag: drizzleMigrations.tag })
        .from(drizzleMigrations)
        .all()

    const appliedSet = new Set(applied.map(row => row.tag))

    const tags = Object.keys(migrations).sort()

    for (const tag of tags) {
        if (appliedSet.has(tag)) {
            continue
        }

        const migrationSql = migrations[tag]

        const statements = migrationSql
            .split('--> statement-breakpoint')
            .map(s => s.trim())
            .filter(s => s.length > 0)

        // One transaction per migration, covering the tag insert too: an
        // interrupted or failed run must leave no half-applied schema, or the
        // retry on next boot hits errors like "duplicate column" forever.
        await db.run(sql.raw('BEGIN'))
        try {
            for (const statement of statements) {
                await db.run(sql.raw(statement))
            }
            await db
                .insert(drizzleMigrations)
                .values({ tag, createdAt: Date.now() })
                .run()
            await db.run(sql.raw('COMMIT'))
        } catch (error) {
            try {
                await db.run(sql.raw('ROLLBACK'))
            } catch {
                // The connection may already be unusable; the original
                // error below is the one that matters.
            }
            throw error
        }
    }
}

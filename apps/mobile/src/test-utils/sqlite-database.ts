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

// Real in-memory SQLite implementation of `DatabaseService` for
// integration tests. The production driver uses expo-sqlite (mobile);
// under jsdom we delegate to `@perawallet/wallet-core-database`'s test
// utility, which spins up a `better-sqlite3` instance behind a
// `drizzle-orm/sqlite-proxy` adapter — same shape the production
// driver returns. Using the published test-utils export keeps the
// drizzle / better-sqlite3 deps inside the database package's
// dependency surface; apps/mobile doesn't pick them up directly.

import { createTestDatabase } from '@perawallet/wallet-core-database/test-utils'
import type {
    Database,
    DatabaseDriver,
    DatabaseService,
} from '@perawallet/wallet-extension-platform'

type Entry = {
    db: Database
    teardown: () => void
}

class OpaqueDriver implements DatabaseDriver {
    constructor(readonly driver: unknown) {}
}

/**
 * In-memory SQLite implementation of `DatabaseService`. Each opened
 * name gets its own `:memory:` instance so tests that touch different
 * logical databases don't trample each other; in practice the app only
 * opens `pera.db`.
 */
export class SqliteTestDatabaseService implements DatabaseService {
    private readonly entries = new Map<string, Entry>()

    async open(name: string): Promise<DatabaseDriver> {
        const entry = this.getOrCreate(name)
        return new OpaqueDriver(entry.db)
    }

    async getDatabase(name: string): Promise<Database> {
        return this.getOrCreate(name).db
    }

    async close(name: string): Promise<void> {
        const entry = this.entries.get(name)
        if (entry) {
            entry.teardown()
            this.entries.delete(name)
        }
    }

    async delete(name: string): Promise<void> {
        await this.close(name)
    }

    private getOrCreate(name: string): Entry {
        let entry = this.entries.get(name)
        if (!entry) {
            entry = createTestDatabase()
            this.entries.set(name, entry)
        }
        return entry
    }

    // Test helper: drop everything so the next test starts with a fresh
    // in-memory DB. Closes any open SQLite handles.
    reset(): void {
        for (const entry of this.entries.values()) {
            entry.teardown()
        }
        this.entries.clear()
    }
}

// Process-wide singleton — shared by `platform-driver-test.ts` (which
// hands it back through `getProvider().database`) and the test-only
// setup helpers in `database-setup.ts` that need to seed/reset it
// directly. Owned by this file so consumers can import it without
// touching `platform-driver-test.ts`, which is aliased to the
// `@perawallet/wallet-extension-platform-driver` package and therefore
// transparently re-mocked by `vi.mock(...)` calls in the unit setup.
export const testDatabaseService = new SqliteTestDatabaseService()

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

import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { DatabaseService } from '@perawallet/wallet-extension-platform'
import {
    initializeDatabase,
    getDatabase,
    resetDatabase,
    deleteDatabase,
} from '../database'

vi.mock('../migrator', () => ({
    runMigrations: vi.fn(),
}))

vi.mock('../migrations', () => ({
    default: [],
}))

describe('deleteDatabase', () => {
    const mockDatabaseService: DatabaseService = {
        open: vi.fn(),
        getDatabase: vi.fn().mockResolvedValue({}),
        close: vi.fn(),
        delete: vi.fn().mockResolvedValue(undefined),
    }

    beforeEach(() => {
        vi.clearAllMocks()
        resetDatabase()
    })

    it('calls databaseService.delete with the database name', async () => {
        await deleteDatabase(mockDatabaseService)

        expect(mockDatabaseService.delete).toHaveBeenCalledWith('pera.db')
    })

    it('resets the internal instance to null', async () => {
        await initializeDatabase(mockDatabaseService)
        expect(() => getDatabase()).not.toThrow()

        await deleteDatabase(mockDatabaseService)

        expect(() => getDatabase()).toThrow(
            'Database not initialized. Call initializeDatabase() during app bootstrap.',
        )
    })

    it('can be re-initialized after deletion', async () => {
        await initializeDatabase(mockDatabaseService)
        await deleteDatabase(mockDatabaseService)
        await initializeDatabase(mockDatabaseService)

        expect(() => getDatabase()).not.toThrow()
        expect(mockDatabaseService.getDatabase).toHaveBeenCalledTimes(2)
    })
})

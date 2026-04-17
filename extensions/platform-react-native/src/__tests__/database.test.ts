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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { RNDatabaseService } from '../services/database'

const mockCloseAsync = vi.fn()
const mockRunAsync = vi.fn().mockResolvedValue(undefined)
const mockGetAllAsync = vi.fn().mockResolvedValue([])
const mockDb = {
    closeAsync: mockCloseAsync,
    runAsync: mockRunAsync,
    getAllAsync: mockGetAllAsync,
}
const mockOpenDatabaseAsync = vi.fn().mockResolvedValue(mockDb)
const mockDeleteDatabaseAsync = vi.fn().mockResolvedValue(undefined)

vi.mock('expo-sqlite', () => ({
    openDatabaseAsync: (...args: unknown[]) => mockOpenDatabaseAsync(...args),
    deleteDatabaseAsync: (...args: unknown[]) =>
        mockDeleteDatabaseAsync(...args),
}))

describe('RNDatabaseService', () => {
    let service: RNDatabaseService

    beforeEach(() => {
        service = new RNDatabaseService()
        vi.clearAllMocks()
    })

    describe('open', () => {
        it('opens a new database on first call', async () => {
            const result = await service.open('test.db')

            expect(mockOpenDatabaseAsync).toHaveBeenCalledWith('test.db')
            expect(result.driver).toBe(mockDb)
        })

        it('returns cached database on subsequent calls', async () => {
            await service.open('test.db')
            await service.open('test.db')

            expect(mockOpenDatabaseAsync).toHaveBeenCalledTimes(1)
        })

        it('opens separate databases for different names', async () => {
            const secondMockDb = { closeAsync: vi.fn() }
            mockOpenDatabaseAsync
                .mockResolvedValueOnce(mockDb)
                .mockResolvedValueOnce(secondMockDb)

            const first = await service.open('first.db')
            const second = await service.open('second.db')

            expect(mockOpenDatabaseAsync).toHaveBeenCalledTimes(2)
            expect(first.driver).toBe(mockDb)
            expect(second.driver).toBe(secondMockDb)
        })
    })

    describe('getDatabase', () => {
        it('returns a Drizzle database instance', async () => {
            const result = await service.getDatabase('test.db')

            expect(mockOpenDatabaseAsync).toHaveBeenCalledWith('test.db')
            expect(result).toHaveProperty('select')
            expect(result).toHaveProperty('insert')
            expect(result).toHaveProperty('delete')
            expect(result).toHaveProperty('run')
            expect(result).toHaveProperty('all')
        })

        it('reuses the same underlying connection', async () => {
            await service.getDatabase('test.db')
            await service.getDatabase('test.db')

            expect(mockOpenDatabaseAsync).toHaveBeenCalledTimes(1)
        })
    })

    describe('close', () => {
        it('closes an open database', async () => {
            await service.open('test.db')
            await service.close('test.db')

            expect(mockCloseAsync).toHaveBeenCalledOnce()
        })

        it('does nothing for an unknown database name', async () => {
            await service.close('unknown.db')

            expect(mockCloseAsync).not.toHaveBeenCalled()
        })

        it('removes database from cache so next open creates a new one', async () => {
            await service.open('test.db')
            await service.close('test.db')

            await service.open('test.db')

            expect(mockOpenDatabaseAsync).toHaveBeenCalledTimes(2)
        })
    })

    describe('delete', () => {
        it('closes the database and deletes the file', async () => {
            await service.open('test.db')
            await service.delete('test.db')

            expect(mockCloseAsync).toHaveBeenCalledOnce()
            expect(mockDeleteDatabaseAsync).toHaveBeenCalledWith('test.db')
        })

        it('deletes even if database was not previously opened', async () => {
            await service.delete('unknown.db')

            expect(mockCloseAsync).not.toHaveBeenCalled()
            expect(mockDeleteDatabaseAsync).toHaveBeenCalledWith('unknown.db')
        })

        it('removes database from cache so next open creates a new one', async () => {
            await service.open('test.db')
            await service.delete('test.db')
            await service.open('test.db')

            expect(mockOpenDatabaseAsync).toHaveBeenCalledTimes(2)
        })
    })

    describe('drizzle proxy SQL execution', () => {
        it('routes run() to runAsync and rewrites null params to NULL literals', async () => {
            const { sql } = await import('drizzle-orm')
            const db = await service.getDatabase('test.db')

            await db.run(sql`INSERT INTO t VALUES (${'x'}, ${null}, ${42})`)

            const [rewritten, params] = mockRunAsync.mock.calls.at(-1)!
            expect(rewritten).toMatch(/NULL/)
            expect(params).toEqual(['x', 42])
        })

        it('routes select() through getAllAsync and maps rows to value arrays', async () => {
            mockGetAllAsync.mockResolvedValueOnce([
                { id: 1, name: 'a' },
                { id: 2, name: 'b' },
            ])

            const { sql } = await import('drizzle-orm')
            const db = await service.getDatabase('test.db')

            const rows = await db.all(sql`SELECT id, name FROM t`)

            expect(mockGetAllAsync).toHaveBeenCalled()
            expect(rows).toEqual([
                [1, 'a'],
                [2, 'b'],
            ])
        })

        it('stringifies non-primitive, non-Uint8Array params before binding', async () => {
            const { sql } = await import('drizzle-orm')
            const db = await service.getDatabase('test.db')

            await db.run(sql`INSERT INTO t VALUES (${{ nested: true }})`)

            const [, params] = mockRunAsync.mock.calls.at(-1)!
            expect(params[0]).toBe('[object Object]')
        })
    })
})

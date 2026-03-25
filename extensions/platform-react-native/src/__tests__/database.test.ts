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
const mockDb = { closeAsync: mockCloseAsync }
const mockOpenDatabaseAsync = vi.fn().mockResolvedValue(mockDb)

vi.mock('expo-sqlite', () => ({
    openDatabaseAsync: (...args: unknown[]) => mockOpenDatabaseAsync(...args),
}))

const mockDrizzleInstance = {} as Record<string, unknown>
vi.mock('drizzle-orm/expo-sqlite', () => ({
    drizzle: () => mockDrizzleInstance,
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
        it('returns a drizzle database instance', async () => {
            const result = await service.getDatabase('test.db')

            expect(mockOpenDatabaseAsync).toHaveBeenCalledWith('test.db')
            expect(result).toBe(mockDrizzleInstance)
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
})

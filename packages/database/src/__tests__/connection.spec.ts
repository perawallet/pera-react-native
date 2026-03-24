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

import { describe, it, expect, afterEach } from 'vitest'
import { getDrizzle, setDrizzle, resetDrizzle } from '../connection'
import { createTestDatabase } from '../test-utils'

describe('connection', () => {
    afterEach(() => {
        resetDrizzle()
    })

    describe('getDrizzle', () => {
        it('throws when database is not initialized', () => {
            expect(() => getDrizzle()).toThrow(
                'Database not initialized. Call setDrizzle() during app bootstrap.',
            )
        })

        it('returns the drizzle instance after setDrizzle is called', () => {
            const { db, teardown } = createTestDatabase()

            expect(getDrizzle()).toBe(db)

            teardown()
        })
    })

    describe('setDrizzle', () => {
        it('replaces the instance on subsequent calls', () => {
            const { db: firstDb, teardown: teardownFirst } =
                createTestDatabase()

            expect(getDrizzle()).toBe(firstDb)

            resetDrizzle()

            const { db: secondDb, teardown: teardownSecond } =
                createTestDatabase()

            expect(getDrizzle()).toBe(secondDb)
            expect(getDrizzle()).not.toBe(firstDb)

            teardownFirst()
            teardownSecond()
        })
    })

    describe('resetDrizzle', () => {
        it('clears the instance so getDrizzle throws again', () => {
            const { teardown } = createTestDatabase()

            expect(() => getDrizzle()).not.toThrow()

            teardown()

            expect(() => getDrizzle()).toThrow()
        })
    })
})

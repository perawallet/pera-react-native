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

import { beforeEach, describe, expect, it } from 'vitest'
import { createChromeFake, type ChromeFake } from '../../test-utils/chrome'
import {
    clearFailedAttempts,
    getLockoutRemainingSeconds,
    recordFailedAttempt,
} from '../lockout'

describe('vault lockout', () => {
    let fake: ChromeFake

    beforeEach(() => {
        fake = createChromeFake()
        globalThis.chrome = fake.chrome
    })

    it('is not locked out before 5 failures', async () => {
        for (let i = 0; i < 4; i++) await recordFailedAttempt()
        expect(await getLockoutRemainingSeconds()).toBe(0)
    })

    it('locks for 30s after the 5th failure', async () => {
        for (let i = 0; i < 5; i++) await recordFailedAttempt()
        expect(await getLockoutRemainingSeconds()).toBeGreaterThan(28)
        expect(await getLockoutRemainingSeconds()).toBeLessThanOrEqual(30)
    })

    it('doubles the lockout each block: 10th failure -> 60s', async () => {
        for (let i = 0; i < 10; i++) await recordFailedAttempt()
        expect(await getLockoutRemainingSeconds()).toBeGreaterThan(58)
    })

    it('clearFailedAttempts resets everything', async () => {
        for (let i = 0; i < 5; i++) await recordFailedAttempt()
        await clearFailedAttempts()
        expect(await getLockoutRemainingSeconds()).toBe(0)
    })
})

// Concurrent unlock attempts from different extension surfaces each read the
// same counter and wrote value+1, so parallel guesses under-counted against
// the 5-attempt threshold.
it('counts concurrent failed attempts without losing any', async () => {
    await Promise.all(Array.from({ length: 5 }, () => recordFailedAttempt()))

    // Five genuine failures must produce a lockout, however they interleaved.
    expect(await getLockoutRemainingSeconds()).toBeGreaterThan(0)
})

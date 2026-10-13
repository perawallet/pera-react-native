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

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createChromeFake, type ChromeFake } from '../../test-utils/chrome'
import { VaultLockedOutError } from '../../errors'
import {
    clearFailedAttempts,
    getLockoutRemainingSeconds,
    runThrottledAttempt,
} from '../lockout'

class WrongPassword extends Error {}

const isWrongPassword = (error: unknown): boolean =>
    error instanceof WrongPassword

const failAttempt = (): Promise<void> =>
    runThrottledAttempt(async () => {
        throw new WrongPassword()
    }, isWrongPassword).catch(() => {})

const failAttempts = async (count: number): Promise<void> => {
    for (let i = 0; i < count; i++) await failAttempt()
}

describe('vault lockout', () => {
    let fake: ChromeFake

    beforeEach(() => {
        fake = createChromeFake()
        globalThis.chrome = fake.chrome
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('is not locked out before 5 failures', async () => {
        await failAttempts(4)
        expect(await getLockoutRemainingSeconds()).toBe(0)
    })

    it('locks for 30s after the 5th failure', async () => {
        await failAttempts(5)
        expect(await getLockoutRemainingSeconds()).toBeGreaterThan(28)
        expect(await getLockoutRemainingSeconds()).toBeLessThanOrEqual(30)
    })

    it('doubles the lockout each block: 10th failure -> 60s', async () => {
        await failAttempts(5)
        // The 6th-10th attempts need the first lockout to have passed.
        const lockout = fake.data.get('vault:lockout') as Record<
            string,
            unknown
        >
        fake.data.set('vault:lockout', {
            ...lockout,
            lockoutEndTime: 0,
            monotonicLockout: undefined,
        })
        await failAttempts(5)
        expect(await getLockoutRemainingSeconds()).toBeGreaterThan(58)
    })

    it('refuses an attempt while locked out without running it', async () => {
        await failAttempts(5)
        const attempt = vi.fn(async () => 'unlocked')

        await expect(
            runThrottledAttempt(attempt, isWrongPassword),
        ).rejects.toBeInstanceOf(VaultLockedOutError)
        expect(attempt).not.toHaveBeenCalled()
    })

    it('does not count an error that is not a wrong password', async () => {
        for (let i = 0; i < 5; i++) {
            await runThrottledAttempt(async () => {
                throw new Error('corrupted')
            }, isWrongPassword).catch(() => {})
        }
        expect(fake.data.get('vault:lockout')).toBeUndefined()
    })

    it('clears the counter on a successful attempt', async () => {
        await failAttempts(4)

        await runThrottledAttempt(async () => 'unlocked', isWrongPassword)

        await failAttempt()
        expect(await getLockoutRemainingSeconds()).toBe(0)
    })

    it('clearFailedAttempts resets everything', async () => {
        await failAttempts(5)
        await clearFailedAttempts()
        expect(await getLockoutRemainingSeconds()).toBe(0)
    })

    it('stays locked out when the system clock jumps forward', async () => {
        await failAttempts(5)
        const now = Date.now()
        vi.spyOn(Date, 'now').mockReturnValue(now + 60 * 60 * 1000)

        expect(await getLockoutRemainingSeconds()).toBeGreaterThan(28)
    })

    it('falls back to the wall clock for a lockout another context recorded', async () => {
        await failAttempts(5)
        const lockout = fake.data.get('vault:lockout') as {
            monotonicLockout: { timeOrigin: number; endTime: number }
        }
        fake.data.set('vault:lockout', {
            ...lockout,
            monotonicLockout: {
                ...lockout.monotonicLockout,
                timeOrigin: performance.timeOrigin - 1,
            },
        })
        vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 60 * 60 * 1000)

        expect(await getLockoutRemainingSeconds()).toBe(0)
    })

    // Surfaces open at once (popup, expanded tab, approval window) each used to
    // pass the check before any recorded a failure, and parallel failures
    // could each read the same counter and write value+1.
    it('serialises parallel attempts so none gets a free guess', async () => {
        const attempt = vi.fn(async () => {
            await new Promise(resolve => setTimeout(resolve, 5))
            throw new WrongPassword()
        })

        const results = await Promise.allSettled(
            Array.from({ length: 6 }, () =>
                runThrottledAttempt(attempt, isWrongPassword),
            ),
        )

        expect(attempt).toHaveBeenCalledTimes(5)
        expect(
            results.filter(
                result =>
                    result.status === 'rejected' &&
                    result.reason instanceof VaultLockedOutError,
            ),
        ).toHaveLength(1)
    })
})

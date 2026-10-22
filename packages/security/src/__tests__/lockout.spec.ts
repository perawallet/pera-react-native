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

import { describe, expect, test, vi } from 'vitest'
import {
    CLEARED_LOCKOUT,
    calculateLockoutSeconds,
    createLockoutDeadline,
    getLiveLockout,
    getLockoutRemainingMs,
    readLockoutClocks,
    resolveLockout,
    type LockoutClocks,
} from '../lockout'

const providerMock = vi.hoisted(() => ({
    now: vi.fn(),
}))

vi.mock('@perawallet/wallet-extension-provider', () => ({
    getProvider: () => ({ monotonicClock: { now: providerMock.now } }),
}))

const WALL = 1_700_000_000_000

const clocksAt = (
    wallNowMs: number,
    elapsedMs: number,
    bootId = 'boot-1',
): LockoutClocks => ({ wallNowMs, monotonic: { bootId, elapsedMs } })

// A 30s lockout started at WALL / elapsed 1000 on boot-1.
const LIVE = {
    failedAttempts: 5,
    lockoutEndTime: WALL + 30_000,
    monotonicLockout: { bootId: 'boot-1', endElapsedMs: 31_000 },
}

describe('calculateLockoutSeconds', () => {
    test.each([
        [4, 0],
        [5, 30],
        [9, 30],
        [10, 60],
        [15, 120],
    ])('%i failed attempts lock for %i seconds', (attempts, seconds) => {
        expect(calculateLockoutSeconds(attempts)).toBe(seconds)
    })
})

describe('createLockoutDeadline', () => {
    test('anchors the deadline on both clocks', () => {
        const deadline = createLockoutDeadline(30_000, clocksAt(WALL, 1000.4))

        expect(deadline).toEqual({
            lockoutEndTime: WALL + 30_000,
            monotonicLockout: { bootId: 'boot-1', endElapsedMs: 31_001 },
        })
    })

    test('leaves the monotonic deadline empty without a reading', () => {
        const deadline = createLockoutDeadline(30_000, {
            wallNowMs: WALL,
            monotonic: null,
        })

        expect(deadline).toEqual({
            lockoutEndTime: WALL + 30_000,
            monotonicLockout: null,
        })
    })
})

describe('resolveLockout', () => {
    test('reports no lockout when none is set', () => {
        const resolution = resolveLockout(
            { failedAttempts: 2, ...CLEARED_LOCKOUT },
            clocksAt(WALL, 1000),
        )

        expect(resolution).toEqual({ remainingMs: 0, update: null })
    })

    test('keeps the monotonic remainder when the wall clock jumps past the deadline', () => {
        const resolution = resolveLockout(
            LIVE,
            clocksAt(WALL + 3_600_000, 11_000),
        )

        expect(resolution).toEqual({ remainingMs: 20_000, update: null })
    })

    test('keeps the wall remainder when the wall clock is set back', () => {
        const resolution = resolveLockout(LIVE, clocksAt(WALL - 60_000, 11_000))

        expect(resolution).toEqual({ remainingMs: 90_000, update: null })
    })

    test('clears the lockout once both deadlines have passed', () => {
        const resolution = resolveLockout(LIVE, clocksAt(WALL + 31_000, 32_000))

        expect(resolution).toEqual({ remainingMs: 0, update: CLEARED_LOCKOUT })
    })

    test('restarts the full window after a reboot, whatever the wall clock says', () => {
        const resolution = resolveLockout(
            { ...LIVE, failedAttempts: 10 },
            clocksAt(WALL + 3_600_000, 500, 'boot-2'),
        )

        expect(resolution).toEqual({
            remainingMs: 60_000,
            update: {
                lockoutEndTime: WALL + 3_600_000 + 60_000,
                monotonicLockout: { bootId: 'boot-2', endElapsedMs: 60_500 },
            },
        })
    })

    test('honours and anchors a live deadline written without a monotonic one', () => {
        const resolution = resolveLockout(
            { ...LIVE, monotonicLockout: null },
            clocksAt(WALL + 10_000, 4000),
        )

        expect(resolution).toEqual({
            remainingMs: 20_000,
            update: {
                lockoutEndTime: WALL + 30_000,
                monotonicLockout: { bootId: 'boot-1', endElapsedMs: 24_000 },
            },
        })
    })

    test('clears an expired deadline written without a monotonic one', () => {
        const resolution = resolveLockout(
            { ...LIVE, monotonicLockout: null },
            clocksAt(WALL + 30_000, 4000),
        )

        expect(resolution).toEqual({ remainingMs: 0, update: CLEARED_LOCKOUT })
    })

    test('falls back to the wall clock without a monotonic reading', () => {
        const resolution = resolveLockout(LIVE, {
            wallNowMs: WALL + 10_000,
            monotonic: null,
        })

        expect(resolution).toEqual({ remainingMs: 20_000, update: null })
    })

    test('clears an expired deadline without a monotonic reading', () => {
        const resolution = resolveLockout(LIVE, {
            wallNowMs: WALL + 30_000,
            monotonic: null,
        })

        expect(resolution).toEqual({ remainingMs: 0, update: CLEARED_LOCKOUT })
    })
})

describe('getLiveLockout', () => {
    test('is null once the lockout has resolved to zero', () => {
        expect(
            getLiveLockout(LIVE, { remainingMs: 0, update: CLEARED_LOCKOUT }),
        ).toBeNull()
    })

    test('applies the update to a live lockout', () => {
        const update = {
            lockoutEndTime: WALL + 90_000,
            monotonicLockout: { bootId: 'boot-2', endElapsedMs: 60_000 },
        }

        expect(getLiveLockout(LIVE, { remainingMs: 60_000, update })).toEqual(
            update,
        )
    })

    test('keeps the stored fields when nothing changed', () => {
        expect(
            getLiveLockout(LIVE, { remainingMs: 20_000, update: null }),
        ).toEqual({
            lockoutEndTime: LIVE.lockoutEndTime,
            monotonicLockout: LIVE.monotonicLockout,
        })
    })
})

describe('getLockoutRemainingMs', () => {
    test('is zero without a lockout', () => {
        expect(getLockoutRemainingMs(null, 5, clocksAt(WALL, 0))).toBe(0)
    })

    test('resolves an in-memory lockout against the current clocks', () => {
        const lockout = {
            lockoutEndTime: LIVE.lockoutEndTime,
            monotonicLockout: LIVE.monotonicLockout,
        }

        expect(
            getLockoutRemainingMs(
                lockout,
                5,
                clocksAt(WALL + 3_600_000, 21_000),
            ),
        ).toBe(10_000)
    })
})

describe('readLockoutClocks', () => {
    test('pairs the wall clock with the platform monotonic reading', () => {
        vi.spyOn(Date, 'now').mockReturnValue(WALL)
        providerMock.now.mockReturnValue({ bootId: 'boot-7', elapsedMs: 42 })

        expect(readLockoutClocks()).toEqual({
            wallNowMs: WALL,
            monotonic: { bootId: 'boot-7', elapsedMs: 42 },
        })
    })
})

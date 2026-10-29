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

import { describe, expect, it } from 'vitest'
import {
    EXPIRED_AUTO_LOCK_START,
    hasAutoLockExpired,
    parseAutoLockStart,
    type AutoLockStart,
} from '../autoLock'
import { AUTO_LOCK_TIMEOUT_MS } from '../constants'
import type { LockoutClocks } from '../lockout'

const HOUR_MS = 60 * 60 * 1000
const EPOCH_NOW_MS = 1_700_000_000_000

const clocks = (
    wallNowMs: number,
    elapsedMs: number,
    bootId = 'boot-1',
): LockoutClocks => ({ wallNowMs, monotonic: { bootId, elapsedMs } })

const start: AutoLockStart = clocks(1_000_000, 5_000)

describe('hasAutoLockExpired', () => {
    it('stays unlocked up to and including the timeout, then locks', () => {
        expect(
            hasAutoLockExpired(
                start,
                clocks(1_000_000, 5_000 + AUTO_LOCK_TIMEOUT_MS),
            ),
        ).toBe(false)
        expect(
            hasAutoLockExpired(
                start,
                clocks(1_000_000, 5_000 + AUTO_LOCK_TIMEOUT_MS + 1),
            ),
        ).toBe(true)
    })

    it('ignores the wall clock moved forward while the monotonic reading is within the timeout', () => {
        expect(
            hasAutoLockExpired(start, clocks(1_000_000 + HOUR_MS, 65_000)),
        ).toBe(false)
    })

    it('locks when the wall clock is moved back but the monotonic reading is past the timeout', () => {
        expect(
            hasAutoLockExpired(
                start,
                clocks(1_000_000 - HOUR_MS, 5_000 + AUTO_LOCK_TIMEOUT_MS + 1),
            ),
        ).toBe(true)
    })

    it('locks after a reboot, whose elapsed time restarts from zero', () => {
        expect(
            hasAutoLockExpired(start, clocks(1_000_000, 6_000, 'boot-2')),
        ).toBe(true)
    })

    it('locks when the start has no monotonic reading but one exists now', () => {
        const wallOnly: AutoLockStart = {
            wallNowMs: 1_000_000,
            monotonic: null,
        }

        expect(hasAutoLockExpired(wallOnly, clocks(1_000_000, 6_000))).toBe(
            true,
        )
    })

    it('locks when the monotonic reading went backwards within a boot', () => {
        expect(hasAutoLockExpired(start, clocks(1_000_000, 4_000))).toBe(true)
    })

    describe('without a native clock', () => {
        const noNative = (wallNowMs: number): LockoutClocks => ({
            wallNowMs,
            monotonic: null,
        })
        const wallStart: AutoLockStart = noNative(1_000_000)

        it('decides on the wall clock', () => {
            expect(
                hasAutoLockExpired(
                    wallStart,
                    noNative(1_000_000 + AUTO_LOCK_TIMEOUT_MS),
                ),
            ).toBe(false)
            expect(
                hasAutoLockExpired(
                    wallStart,
                    noNative(1_000_000 + AUTO_LOCK_TIMEOUT_MS + 1),
                ),
            ).toBe(true)
        })

        it('locks on a start in the future', () => {
            expect(hasAutoLockExpired(wallStart, noNative(999_999))).toBe(true)
        })
    })
})

describe('parseAutoLockStart', () => {
    it.each([null, undefined])('treats %s as no timer running', value => {
        expect(parseAutoLockStart(value)).toBeNull()
    })

    it('round-trips a valid start as a fresh copy', () => {
        const parsed = parseAutoLockStart(JSON.parse(JSON.stringify(start)))

        expect(parsed).toEqual(start)
        expect(parsed).not.toBe(start)
    })

    it('accepts a start with no monotonic reading', () => {
        const wallOnly = { wallNowMs: 42, monotonic: null }

        expect(parseAutoLockStart(wallOnly)).toEqual(wallOnly)
    })

    it.each([
        ['an epoch number from the previous build', 1_700_000_000_000],
        ['NaN', Number.NaN],
        ['a string', 'later'],
        ['an empty object', {}],
        ['a negative wall time', { wallNowMs: -1, monotonic: null }],
        ['a non-finite wall time', { wallNowMs: Infinity, monotonic: null }],
        [
            'an empty boot id',
            { wallNowMs: 1, monotonic: { bootId: '', elapsedMs: 1 } },
        ],
        [
            'a negative elapsed time',
            { wallNowMs: 1, monotonic: { bootId: 'b', elapsedMs: -1 } },
        ],
        ['a missing monotonic field', { wallNowMs: 1 }],
    ])('resolves %s to expired', (_label, value) => {
        expect(parseAutoLockStart(value)).toEqual(EXPIRED_AUTO_LOCK_START)
    })

    it('resolves the expired start to a lock under either clock', () => {
        expect(
            hasAutoLockExpired(
                EXPIRED_AUTO_LOCK_START,
                clocks(EPOCH_NOW_MS, 1),
            ),
        ).toBe(true)
        expect(
            hasAutoLockExpired(EXPIRED_AUTO_LOCK_START, {
                wallNowMs: EPOCH_NOW_MS,
                monotonic: null,
            }),
        ).toBe(true)
    })
})

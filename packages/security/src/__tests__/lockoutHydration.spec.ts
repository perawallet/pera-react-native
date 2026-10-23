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

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { MemoryMonotonicClockService } from '@test-utils/monotonic-clock'
import { hydrateLockoutState } from '../lockoutHydration'
import { withPinRecordLock } from '../pinRecordLock'
import {
    PIN_RECORD_VERSION,
    parsePinRecord,
    serializePinRecord,
    type PinRecord,
} from '../pinRecord'

const clockMock = vi.hoisted(() => ({
    current: null as { now: () => unknown } | null,
}))

vi.mock('@perawallet/wallet-extension-provider', () => ({
    getProvider: () => ({ monotonicClock: clockMock.current }),
}))

const WALL = 1_700_000_000_000

const baseRecord: PinRecord = {
    version: PIN_RECORD_VERSION,
    salt: '00'.repeat(16),
    hash: '11'.repeat(32),
    duressSalt: '22'.repeat(16),
    duressHash: '33'.repeat(32),
    duressEnabled: 0,
    failedAttempts: 5,
    lockoutEndTime: WALL + 30_000,
    monotonicLockout: { bootId: 'boot-1', endElapsedMs: 31_000 },
}

const makeKms = (initial: PinRecord) => {
    let stored = serializePinRecord(initial)
    const read = vi.fn()
    return {
        read,
        stored: () => parsePinRecord(stored),
        withSecret: async <T>(
            _id: string,
            handler: (bytes: Uint8Array) => T | Promise<T>,
        ): Promise<T | null> => {
            read()
            return handler(stored)
        },
        commitSecret: vi.fn(
            async ({ bytes }: { id: string; bytes: Uint8Array }) => {
                stored = new Uint8Array(bytes)
            },
        ),
        removeSecret: vi.fn(async () => undefined),
    }
}

describe('hydrateLockoutState', () => {
    let clock: MemoryMonotonicClockService

    beforeEach(() => {
        clock = new MemoryMonotonicClockService({
            bootId: 'boot-1',
            elapsedMs: 1000,
        })
        clockMock.current = clock
        vi.spyOn(Date, 'now').mockReturnValue(WALL)
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    test('concurrent callers share one record read', async () => {
        const kms = makeKms(baseRecord)

        const [first, second] = await Promise.all([
            hydrateLockoutState(kms),
            hydrateLockoutState(kms),
        ])

        expect(kms.read).toHaveBeenCalledTimes(1)
        expect(first).toEqual({
            failedAttempts: 5,
            lockout: {
                lockoutEndTime: baseRecord.lockoutEndTime,
                monotonicLockout: baseRecord.monotonicLockout,
            },
        })
        expect(second).toEqual(first)
    })

    test('a caller after the read settles reads the record again', async () => {
        const kms = makeKms(baseRecord)

        await hydrateLockoutState(kms)
        await hydrateLockoutState(kms)

        expect(kms.read).toHaveBeenCalledTimes(2)
    })

    test('a live deadline that needs no change is not written', async () => {
        const kms = makeKms(baseRecord)

        await hydrateLockoutState(kms)

        expect(kms.commitSecret).not.toHaveBeenCalled()
    })

    test('a deadline from another boot is re-anchored on this one and written', async () => {
        const kms = makeKms(baseRecord)
        clock.reboot()
        clock.advance(500)

        const state = await hydrateLockoutState(kms)

        const reanchored = {
            lockoutEndTime: WALL + 30_000,
            monotonicLockout: { bootId: 'boot-2', endElapsedMs: 30_500 },
        }
        expect(state).toEqual({ failedAttempts: 5, lockout: reanchored })
        expect(kms.stored()).toEqual({ ...baseRecord, ...reanchored })
    })

    test('an expired deadline is cleared from the record', async () => {
        const kms = makeKms(baseRecord)
        clock.advance(31_000)
        vi.spyOn(Date, 'now').mockReturnValue(WALL + 31_000)

        const state = await hydrateLockoutState(kms)

        expect(state).toEqual({ failedAttempts: 5, lockout: null })
        expect(kms.stored()).toEqual({
            ...baseRecord,
            lockoutEndTime: null,
            monotonicLockout: null,
        })
    })

    test('a failed write still returns the live lockout', async () => {
        const kms = makeKms(baseRecord)
        kms.commitSecret.mockRejectedValueOnce(new Error('keystore busy'))
        clock.reboot()

        const state = await hydrateLockoutState(kms)

        expect(state).toEqual({
            failedAttempts: 5,
            lockout: {
                lockoutEndTime: WALL + 30_000,
                monotonicLockout: { bootId: 'boot-2', endElapsedMs: 30_000 },
            },
        })
        expect(kms.stored()).toEqual(baseRecord)
    })

    test('a PIN attempt arriving while the re-anchor is written keeps its charge', async () => {
        const kms = makeKms(baseRecord)
        clock.reboot()
        let attempt: Promise<void> = Promise.resolve()
        // The second read is the re-anchor's own; a PIN attempt shows up then.
        kms.read.mockImplementation(() => {
            if (kms.read.mock.calls.length !== 2) return
            attempt = withPinRecordLock(async () => {
                const current = kms.stored()!
                await kms.commitSecret({
                    id: 'pera.pinCode',
                    bytes: serializePinRecord({
                        ...current,
                        failedAttempts: current.failedAttempts + 1,
                    }),
                })
            })
        })

        await hydrateLockoutState(kms)
        await attempt

        expect(kms.stored()?.failedAttempts).toBe(6)
        expect(kms.stored()?.monotonicLockout?.bootId).toBe('boot-2')
    })
})

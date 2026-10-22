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

import { getProvider } from '@perawallet/wallet-extension-provider'
import type { MonotonicReading } from '@perawallet/wallet-extension-platform'
import type { Nullable } from '@perawallet/wallet-core-shared'
import {
    INITIAL_LOCKOUT_SECONDS,
    MAX_PIN_ATTEMPTS_BEFORE_LOCKOUT,
} from './constants'

/** A lockout deadline on `MonotonicReading.elapsedMs`'s clock, valid only on `bootId`. */
export type MonotonicLockout = { bootId: string; endElapsedMs: number }

export type LockoutFields = {
    /** Epoch ms. */
    lockoutEndTime: Nullable<number>
    monotonicLockout: Nullable<MonotonicLockout>
}

export type LockoutDeadline = {
    /** Epoch ms. */
    lockoutEndTime: number
    monotonicLockout: Nullable<MonotonicLockout>
}

export type LockoutClocks = {
    wallNowMs: number
    monotonic: Nullable<MonotonicReading>
}

export type LockoutResolution = {
    remainingMs: number
    /** The stored fields to write back: re-anchored or cleared. `null` when unchanged. */
    update: Nullable<LockoutFields>
}

export const CLEARED_LOCKOUT: LockoutFields = {
    lockoutEndTime: null,
    monotonicLockout: null,
}

export const calculateLockoutSeconds = (failedAttempts: number): number => {
    const lockoutBlock = Math.floor(
        failedAttempts / MAX_PIN_ATTEMPTS_BEFORE_LOCKOUT,
    )
    if (lockoutBlock === 0) return 0
    return INITIAL_LOCKOUT_SECONDS * 2 ** (lockoutBlock - 1)
}

export const readLockoutClocks = (): LockoutClocks => ({
    wallNowMs: Date.now(),
    monotonic: getProvider().monotonicClock.now(),
})

export const createLockoutDeadline = (
    durationMs: number,
    clocks: LockoutClocks,
): LockoutDeadline => ({
    lockoutEndTime: clocks.wallNowMs + durationMs,
    monotonicLockout: clocks.monotonic
        ? {
              bootId: clocks.monotonic.bootId,
              endElapsedMs: Math.ceil(clocks.monotonic.elapsedMs + durationMs),
          }
        : null,
})

const restartedFrom = (
    durationMs: number,
    clocks: LockoutClocks,
): LockoutResolution =>
    durationMs > 0
        ? {
              remainingMs: durationMs,
              update: createLockoutDeadline(durationMs, clocks),
          }
        : { remainingMs: 0, update: CLEARED_LOCKOUT }

export const resolveLockout = (
    state: LockoutFields & { failedAttempts: number },
    clocks: LockoutClocks,
): LockoutResolution => {
    if (state.lockoutEndTime === null) return { remainingMs: 0, update: null }
    const wallRemaining = Math.max(0, state.lockoutEndTime - clocks.wallNowMs)
    const { monotonic } = clocks
    // No native source: the wall clock is all there is, as before the
    // monotonic deadline existed.
    if (!monotonic) return { remainingMs: wallRemaining, update: null }

    const stored = state.monotonicLockout
    // Written by a build (or the legacy-app migration) that had no monotonic
    // deadline: trust the wall clock this once, then hold it to the monotonic one.
    if (!stored) return restartedFrom(wallRemaining, clocks)

    // `elapsedMs` restarted at boot, so the time served before it is unknown;
    // trusting the wall clock here is exactly what moving it forward exploits.
    if (stored.bootId !== monotonic.bootId) {
        return restartedFrom(
            calculateLockoutSeconds(state.failedAttempts) * 1000,
            clocks,
        )
    }

    const monotonicRemaining = Math.max(
        0,
        stored.endElapsedMs - monotonic.elapsedMs,
    )
    const remainingMs = Math.max(wallRemaining, monotonicRemaining)
    // Cleared on expiry so a reboot later never restarts a lockout already served.
    return remainingMs > 0
        ? { remainingMs, update: null }
        : { remainingMs: 0, update: CLEARED_LOCKOUT }
}

export const getLiveLockout = (
    state: LockoutFields,
    resolution: LockoutResolution,
): Nullable<LockoutDeadline> => {
    if (resolution.remainingMs === 0) return null
    const { lockoutEndTime, monotonicLockout } = resolution.update ?? state
    return lockoutEndTime === null ? null : { lockoutEndTime, monotonicLockout }
}

export const getLockoutRemainingMs = (
    lockout: Nullable<LockoutDeadline>,
    failedAttempts: number,
    clocks: LockoutClocks,
): number =>
    lockout
        ? resolveLockout({ ...lockout, failedAttempts }, clocks).remainingMs
        : 0

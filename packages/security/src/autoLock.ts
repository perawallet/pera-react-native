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

import type { Nullable } from '@perawallet/wallet-core-shared'
import { AUTO_LOCK_TIMEOUT_MS } from './constants'
import type { LockoutClocks } from './lockout'

/** The clocks read when the app went to the background. */
export type AutoLockStart = LockoutClocks

/**
 * What an unreadable persisted start becomes. It has no monotonic reading, and
 * epoch 0 is long past on the wall-clock fallback, so it reads as expired.
 */
export const EXPIRED_AUTO_LOCK_START: AutoLockStart = {
    wallNowMs: 0,
    monotonic: null,
}

const isNonNegativeFinite = (value: unknown): value is number =>
    typeof value === 'number' && Number.isFinite(value) && value >= 0

// Persisted to unencrypted storage, so a tampered or stale value must never
// disable auto-lock: `null` means "no timer running", which is unlocked, so
// anything unreadable becomes an expired start instead.
export const parseAutoLockStart = (value: unknown): Nullable<AutoLockStart> => {
    if (value === null || value === undefined) return null
    if (typeof value !== 'object') return EXPIRED_AUTO_LOCK_START
    const { wallNowMs, monotonic } = value as Partial<AutoLockStart>
    if (!isNonNegativeFinite(wallNowMs)) return EXPIRED_AUTO_LOCK_START
    if (monotonic === null) return { wallNowMs, monotonic: null }
    if (
        typeof monotonic !== 'object' ||
        typeof monotonic.bootId !== 'string' ||
        monotonic.bootId === '' ||
        !isNonNegativeFinite(monotonic.elapsedMs)
    ) {
        return EXPIRED_AUTO_LOCK_START
    }
    return {
        wallNowMs,
        monotonic: {
            bootId: monotonic.bootId,
            elapsedMs: monotonic.elapsedMs,
        },
    }
}

export const hasAutoLockExpired = (
    start: AutoLockStart,
    now: LockoutClocks,
): boolean => {
    let elapsedMs: number
    if (now.monotonic) {
        // Elapsed time restarts at boot and a missing reading can't be placed
        // on this boot's clock, so both are treated as long past.
        if (
            !start.monotonic ||
            start.monotonic.bootId !== now.monotonic.bootId
        ) {
            return true
        }
        elapsedMs = now.monotonic.elapsedMs - start.monotonic.elapsedMs
    } else {
        elapsedMs = now.wallNowMs - start.wallNowMs
    }
    // A negative elapsed time is a start in the future: fail closed.
    return elapsedMs < 0 || elapsedMs > AUTO_LOCK_TIMEOUT_MS
}

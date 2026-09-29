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

import { VaultLockedOutError } from '../errors'
import { LOCKOUT_STORAGE_KEY } from '../storage-keys'

// Mirrors mobile's PIN lockout (packages/security): every 5th consecutive
// failure locks for 30 * 2^(block-1) seconds. Persisted in
// chrome.storage.local so closing the popup can't reset it.
const MAX_ATTEMPTS_BEFORE_LOCKOUT = 5
const INITIAL_LOCKOUT_SECONDS = 30

type LockoutRecord = {
    failedAttempts: number
    lockoutEndTime: number | null
    /**
     * The same deadline on `performance.now()`'s clock, valid only in the
     * context whose `performance.timeOrigin` wrote it. Moving the system clock
     * forward shortens the wall-clock deadline but not this one.
     */
    monotonicLockout?: { timeOrigin: number; endTime: number }
}

const read = async (): Promise<LockoutRecord> => {
    const stored = await chrome.storage.local.get(LOCKOUT_STORAGE_KEY)
    const record = stored[LOCKOUT_STORAGE_KEY] as
        | Partial<LockoutRecord>
        | undefined
    // Defensive against a partial/malformed stored record (e.g. a future
    // schema change) — fail open on the missing field rather than throw.
    return {
        failedAttempts: record?.failedAttempts ?? 0,
        lockoutEndTime: record?.lockoutEndTime ?? null,
        monotonicLockout: record?.monotonicLockout,
    }
}

const write = async (record: LockoutRecord): Promise<void> => {
    await chrome.storage.local.set({ [LOCKOUT_STORAGE_KEY]: record })
}

// Serialises a whole attempt: the lockout check, the password check and the
// record. Without it, surfaces open at once (popup, expanded tab, approval
// window) could each pass the check before any of them recorded a failure,
// and parallel failures could each read `failedAttempts: N` and write `N+1`.
//
// `navigator.locks` where available, with an in-process promise queue fallback
// for contexts without the Web Locks API. Not re-entrant: nothing inside
// `withLock` may call it again.
let lockQueue: Promise<unknown> = Promise.resolve()

const withLock = async <T>(fn: () => Promise<T>): Promise<T> => {
    if (typeof navigator !== 'undefined' && navigator.locks) {
        return navigator.locks.request('pera-vault-lockout', fn)
    }
    const next = lockQueue.then(fn)
    lockQueue = next.catch(() => {})
    return next
}

const recordFailure = async (): Promise<void> => {
    const record = await read()
    const failedAttempts = record.failedAttempts + 1
    if (failedAttempts % MAX_ATTEMPTS_BEFORE_LOCKOUT !== 0) {
        await write({ ...record, failedAttempts })
        return
    }
    const block = failedAttempts / MAX_ATTEMPTS_BEFORE_LOCKOUT
    const lockoutMs = INITIAL_LOCKOUT_SECONDS * 2 ** (block - 1) * 1000
    await write({
        failedAttempts,
        lockoutEndTime: Date.now() + lockoutMs,
        monotonicLockout: {
            timeOrigin: performance.timeOrigin,
            endTime: performance.now() + lockoutMs,
        },
    })
}

const toSeconds = (ms: number): number => Math.max(0, Math.ceil(ms / 1000))

/** The longer of the wall-clock and (same-context) monotonic deadlines. */
export const getLockoutRemainingSeconds = async (): Promise<number> => {
    const { lockoutEndTime, monotonicLockout } = await read()
    if (lockoutEndTime === null) return 0
    const wallRemaining = toSeconds(lockoutEndTime - Date.now())
    const monotonicRemaining =
        monotonicLockout?.timeOrigin === performance.timeOrigin
            ? toSeconds(monotonicLockout.endTime - performance.now())
            : 0
    return Math.max(wallRemaining, monotonicRemaining)
}

export const clearFailedAttempts = async (): Promise<void> => {
    await chrome.storage.local.remove(LOCKOUT_STORAGE_KEY)
}

/**
 * Runs one password attempt under the lockout: throws `VaultLockedOutError`
 * while locked out, records a failure when `isWrongPassword` says the attempt
 * failed on the password, and clears the counter on success.
 */
export const runThrottledAttempt = async <T>(
    attempt: () => Promise<T>,
    isWrongPassword: (error: unknown) => boolean,
): Promise<T> =>
    withLock(async () => {
        const remainingSeconds = await getLockoutRemainingSeconds()
        if (remainingSeconds > 0)
            throw new VaultLockedOutError(remainingSeconds)
        let result: T
        try {
            result = await attempt()
        } catch (error) {
            if (isWrongPassword(error)) await recordFailure()
            throw error
        }
        await clearFailedAttempts()
        return result
    })

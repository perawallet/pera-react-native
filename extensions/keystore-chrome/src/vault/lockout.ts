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

import type { Nullable, Optional } from '@perawallet/wallet-core-shared'
import { VaultLockedOutError } from '../errors'
import { LOCKOUT_STORAGE_KEY } from '../storage-keys'

// Mirrors mobile's PIN lockout (packages/security): every 5th consecutive
// failure locks for 30 * 2^(block-1) seconds. Persisted in
// chrome.storage.local so closing the popup can't reset it.
const MAX_ATTEMPTS_BEFORE_LOCKOUT = 5
const INITIAL_LOCKOUT_SECONDS = 30

// The web platform has no monotonic clock that survives a change of JS
// context, and the wall clock can be moved, so no deadline is ever compared
// across contexts. Each context (popup, expanded tab, approval window) serves
// the full window on its own `performance.now()`, and the first one to finish
// clears the lockout for all of them, after which nothing is left to exploit.
// `lockoutDeadlines` is `null` when not locked out, else each serving context's
// deadline keyed by its `performance.timeOrigin`; `{}` means none serving yet.
type LockoutRecord = {
    failedAttempts: number
    lockoutDeadlines: Nullable<Record<string, number>>
}

// `ChromeMonotonicClockService`'s reading, read locally because this package
// sits below platform-chrome.
const readMonotonicClock = (): { bootId: string; elapsedMs: number } => ({
    bootId: String(performance.timeOrigin),
    elapsedMs: performance.now(),
})

const lockoutMsForAttempts = (failedAttempts: number): number => {
    const block = Math.floor(failedAttempts / MAX_ATTEMPTS_BEFORE_LOCKOUT)
    if (block === 0) return 0
    return INITIAL_LOCKOUT_SECONDS * 2 ** (block - 1) * 1000
}

const isDeadlineMap = (value: unknown): value is Record<string, number> =>
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.values(value).every(
        deadline => typeof deadline === 'number' && Number.isFinite(deadline),
    )

const read = async (): Promise<LockoutRecord> => {
    const stored = await chrome.storage.local.get(LOCKOUT_STORAGE_KEY)
    const record = stored[LOCKOUT_STORAGE_KEY] as Optional<
        Record<string, unknown>
    >
    const failedAttempts = record?.failedAttempts ?? 0
    // A tampered counter can't size a window, so it serves the first block.
    if (
        typeof failedAttempts !== 'number' ||
        !Number.isInteger(failedAttempts) ||
        failedAttempts < 0
    ) {
        return {
            failedAttempts: MAX_ATTEMPTS_BEFORE_LOCKOUT,
            lockoutDeadlines: {},
        }
    }
    const lockoutDeadlines = record?.lockoutDeadlines
    if (lockoutDeadlines === null || isDeadlineMap(lockoutDeadlines)) {
        return { failedAttempts, lockoutDeadlines }
    }
    // A record from before per-context deadlines, or a malformed one. When the
    // last failure started a lockout, nothing shows it was served, so it's
    // served again in full rather than trusted.
    const startedLockout =
        failedAttempts > 0 && failedAttempts % MAX_ATTEMPTS_BEFORE_LOCKOUT === 0
    return { failedAttempts, lockoutDeadlines: startedLockout ? {} : null }
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
    const { bootId, elapsedMs } = readMonotonicClock()
    await write({
        failedAttempts,
        lockoutDeadlines: {
            [bootId]: elapsedMs + lockoutMsForAttempts(failedAttempts),
        },
    })
}

const toSeconds = (ms: number): number => Math.max(0, Math.ceil(ms / 1000))

// Caller holds the lock. Starts this context's deadline the first time it
// sees a lockout, and clears the lockout for every context once its own passes.
const resolveRemainingMs = async (): Promise<number> => {
    const record = await read()
    const { lockoutDeadlines } = record
    if (lockoutDeadlines === null) return 0
    const { bootId, elapsedMs } = readMonotonicClock()
    const deadline = lockoutDeadlines[bootId]
    if (deadline === undefined) {
        const windowMs = lockoutMsForAttempts(record.failedAttempts)
        if (windowMs === 0) {
            await write({ ...record, lockoutDeadlines: null })
            return 0
        }
        await write({
            ...record,
            lockoutDeadlines: {
                ...lockoutDeadlines,
                [bootId]: elapsedMs + windowMs,
            },
        })
        return windowMs
    }
    const remainingMs = deadline - elapsedMs
    if (remainingMs > 0) return remainingMs
    await write({ ...record, lockoutDeadlines: null })
    return 0
}

/**
 * Seconds left on the lockout, 0 when none. Not a pure read: it starts this
 * context's deadline on first sight of a lockout and clears one it has served.
 */
export const getLockoutRemainingSeconds = async (): Promise<number> =>
    withLock(async () => toSeconds(await resolveRemainingMs()))

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
        const remainingSeconds = toSeconds(await resolveRemainingMs())
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

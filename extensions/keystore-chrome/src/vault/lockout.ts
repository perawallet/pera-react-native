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

import { LOCKOUT_STORAGE_KEY } from '../storage-keys'

// Mirrors mobile's PIN lockout (packages/security): every 5th consecutive
// failure locks for 30 * 2^(block-1) seconds. Persisted in
// chrome.storage.local so closing the popup can't reset it.
const MAX_ATTEMPTS_BEFORE_LOCKOUT = 5
const INITIAL_LOCKOUT_SECONDS = 30

type LockoutRecord = {
    failedAttempts: number
    lockoutEndTime: number | null
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
    }
}

const write = async (record: LockoutRecord): Promise<void> => {
    await chrome.storage.local.set({ [LOCKOUT_STORAGE_KEY]: record })
}

// Serialises the read-modify-write below. Concurrent unlock attempts from
// different extension surfaces (popup, expanded tab, approval window) each
// read the same `failedAttempts: N` and write `N+1`, so parallel guesses
// under-count against the threshold. PBKDF2's cost limited how much
// parallelism was reachable in practice, but Argon2id is a fixed cost too —
// the counter should be correct on its own terms.
//
// Same shape as DappPermissionStore.withLock, including the in-process queue
// fallback for contexts without the Web Locks API.
let lockQueue: Promise<unknown> = Promise.resolve()

const withLock = async <T>(fn: () => Promise<T>): Promise<T> => {
    if (typeof navigator !== 'undefined' && navigator.locks) {
        return navigator.locks.request('pera-vault-lockout', fn)
    }
    const next = lockQueue.then(fn)
    lockQueue = next.catch(() => {})
    return next
}

export const recordFailedAttempt = async (): Promise<void> =>
    withLock(async () => {
        const record = await read()
        const failedAttempts = record.failedAttempts + 1
        let lockoutEndTime = record.lockoutEndTime
        if (failedAttempts % MAX_ATTEMPTS_BEFORE_LOCKOUT === 0) {
            const block = failedAttempts / MAX_ATTEMPTS_BEFORE_LOCKOUT
            const seconds = INITIAL_LOCKOUT_SECONDS * 2 ** (block - 1)
            lockoutEndTime = Date.now() + seconds * 1000
        }
        await write({ failedAttempts, lockoutEndTime })
    })

export const getLockoutRemainingSeconds = async (): Promise<number> => {
    const { lockoutEndTime } = await read()
    if (lockoutEndTime === null) return 0
    return Math.max(0, Math.ceil((lockoutEndTime - Date.now()) / 1000))
}

export const clearFailedAttempts = async (): Promise<void> => {
    await chrome.storage.local.remove(LOCKOUT_STORAGE_KEY)
}

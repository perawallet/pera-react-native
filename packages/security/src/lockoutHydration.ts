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

import { zeroBytes } from '@perawallet/wallet-core-kms'
import { logger, type Nullable } from '@perawallet/wallet-core-shared'
import { PIN_RECORD_KEY_ID } from './constants'
import {
    getLiveLockout,
    readLockoutClocks,
    resolveLockout,
    type LockoutDeadline,
} from './lockout'
import { parsePinRecord, serializePinRecord, type PinRecord } from './pinRecord'
import { migratePinRecordToV3 } from './pinRecordMigration'
import { withPinRecordLock } from './pinRecordLock'

type LockoutState = {
    failedAttempts: number
    lockout: Nullable<LockoutDeadline>
}

type HydrationKms = Parameters<typeof migratePinRecordToV3>[0]

type StoredLockout = Pick<
    PinRecord,
    'failedAttempts' | 'lockoutEndTime' | 'monotonicLockout'
>

const readStoredLockout = (
    kms: HydrationKms,
): Promise<Nullable<StoredLockout>> =>
    kms.withSecret(PIN_RECORD_KEY_ID, bytes => {
        const record = parsePinRecord(bytes)
        return record
            ? {
                  failedAttempts: record.failedAttempts,
                  lockoutEndTime: record.lockoutEndTime,
                  monotonicLockout: record.monotonicLockout,
              }
            : null
    })

// Re-reads under the lock: an attempt may have charged the record since the
// unlocked read, and writing the stale copy back would refund that charge.
const persistResolvedLockout = (
    kms: HydrationKms,
): Promise<Nullable<LockoutState>> =>
    withPinRecordLock(async () => {
        const record = await kms.withSecret(PIN_RECORD_KEY_ID, parsePinRecord)
        if (!record) return null
        const resolution = resolveLockout(record, readLockoutClocks())
        if (resolution.update) {
            const bytes = serializePinRecord({
                ...record,
                ...resolution.update,
            })
            try {
                await kms.commitSecret({ id: PIN_RECORD_KEY_ID, bytes })
            } catch (error) {
                // Still enforced from memory; the next read resolves it again.
                logger.warn('Persisting the resolved PIN lockout failed', {
                    error,
                })
            } finally {
                zeroBytes(bytes)
            }
        }
        return {
            failedAttempts: record.failedAttempts,
            lockout: getLiveLockout(record, resolution),
        }
    })

// Each read fetches the master key, which costs seconds on a slow StrongBox, and
// on a cold start every mounted lock-screen hook plus the biometric prompt want
// these counters at once. Shared only while in flight, so a later caller still
// reads the record rather than a remembered copy; only the counters leave the
// read, never the hashes.
let hydration: Nullable<Promise<Nullable<LockoutState>>> = null

export const hydrateLockoutState = (
    kms: HydrationKms,
): Promise<Nullable<LockoutState>> => {
    hydration ??= (async () => {
        const { lockout: migrated } = await migratePinRecordToV3(kms)
        const stored = migrated ?? (await readStoredLockout(kms))
        if (!stored) return null
        const resolution = resolveLockout(stored, readLockoutClocks())
        if (resolution.update) return persistResolvedLockout(kms)
        return {
            failedAttempts: stored.failedAttempts,
            lockout: getLiveLockout(stored, resolution),
        }
    })().finally(() => {
        hydration = null
    })
    return hydration
}

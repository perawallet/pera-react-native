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
import { PIN_RECORD_KEY_ID } from './constants'
import { parsePinRecord, type PinRecord } from './pinRecord'
import { migratePinRecordToV3 } from './pinRecordMigration'

type LockoutState = Pick<PinRecord, 'failedAttempts' | 'lockoutEndTime'>

type HydrationKms = Parameters<typeof migratePinRecordToV3>[0]

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
        const { lockout } = await migratePinRecordToV3(kms)
        if (lockout) return lockout
        return kms.withSecret(PIN_RECORD_KEY_ID, bytes => {
            const record = parsePinRecord(bytes)
            return record
                ? {
                      failedAttempts: record.failedAttempts,
                      lockoutEndTime: record.lockoutEndTime,
                  }
                : null
        })
    })().finally(() => {
        hydration = null
    })
    return hydration
}

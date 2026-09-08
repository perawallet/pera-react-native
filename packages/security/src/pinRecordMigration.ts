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
import type { Nullable } from '@perawallet/wallet-core-shared'
import { PIN_RECORD_KEY_ID, LEGACY_DURESS_PIN_RECORD_KEY_ID } from './constants'
import {
    PIN_RECORD_VERSION,
    createEmptyDuressSlot,
    parsePinRecord,
    serializePinRecord,
    type PinRecord,
} from './pinRecord'

type KmsAccess = {
    withSecret: <T>(
        id: string,
        handler: (bytes: Uint8Array) => T | Promise<T>,
    ) => Promise<Nullable<T>>
    commitSecret: (params: { id: string; bytes: Uint8Array }) => Promise<void>
    removeSecret: (id: string) => Promise<void>
}

export type PinRecordMigrationResult = {
    /** True when the `pera.pinCode` record was rewritten (callers must
     * re-mirror the biometric blob, which holds a copy of its bytes). */
    migrated: boolean
}

type LegacyV2Record = {
    salt: string
    hash: string
    failedAttempts: number
    lockoutEndTime: number | null
}

const decoder = new TextDecoder()

// The v2 shape: the regular slot's fields, no duress slot. Same strict hex
// validation as v3 — a corrupted legacy record must not be carried forward.
const parseLegacyV2 = (data: Uint8Array): LegacyV2Record | null => {
    let parsed: unknown
    try {
        parsed = JSON.parse(decoder.decode(data))
    } catch {
        return null
    }
    if (typeof parsed !== 'object' || parsed === null) return null
    const r = parsed as Record<string, unknown>

    if (r.version !== 2) return null
    if (typeof r.salt !== 'string' || typeof r.hash !== 'string') return null
    const hexOfLength = (s: string, len: number): boolean =>
        s.length === len && /^[0-9a-f]+$/i.test(s)
    if (!hexOfLength(r.salt, 32) || !hexOfLength(r.hash, 64)) return null
    if (
        typeof r.failedAttempts !== 'number' ||
        !Number.isInteger(r.failedAttempts) ||
        r.failedAttempts < 0
    ) {
        return null
    }
    if (
        r.lockoutEndTime !== null &&
        (typeof r.lockoutEndTime !== 'number' ||
            !Number.isInteger(r.lockoutEndTime) ||
            r.lockoutEndTime < 0)
    ) {
        return null
    }
    return {
        salt: r.salt,
        hash: r.hash,
        failedAttempts: r.failedAttempts,
        lockoutEndTime: r.lockoutEndTime as number | null,
    }
}

let inflight: Promise<PinRecordMigrationResult> | null = null

const runMigration = async (
    kms: KmsAccess,
): Promise<PinRecordMigrationResult> => {
    const current = await kms.withSecret(PIN_RECORD_KEY_ID, bytes => {
        if (parsePinRecord(bytes)) return { kind: 'v3' as const }
        const v2 = parseLegacyV2(bytes)
        return v2 ? { kind: 'v2' as const, v2 } : { kind: 'unknown' as const }
    })

    if (!current || current.kind !== 'v2') {
        // Nothing to merge into, but a lingering legacy record is still the
        // observable tell this migration exists to remove.
        await kms.removeSecret(LEGACY_DURESS_PIN_RECORD_KEY_ID)
        return { migrated: false }
    }

    const legacyDuress = await kms.withSecret(
        LEGACY_DURESS_PIN_RECORD_KEY_ID,
        parseLegacyV2,
    )

    const record: PinRecord = {
        version: PIN_RECORD_VERSION,
        salt: current.v2.salt,
        hash: current.v2.hash,
        ...(legacyDuress
            ? {
                  duressSalt: legacyDuress.salt,
                  duressHash: legacyDuress.hash,
                  duressEnabled: 1 as const,
              }
            : createEmptyDuressSlot()),
        failedAttempts: current.v2.failedAttempts,
        lockoutEndTime: current.v2.lockoutEndTime,
    }

    const bytes = serializePinRecord(record)
    try {
        await kms.commitSecret({ id: PIN_RECORD_KEY_ID, bytes })
    } finally {
        zeroBytes(bytes)
    }
    // Only after the merged record is durably written — a crash between the
    // two writes must lose the tell, never the duress PIN.
    await kms.removeSecret(LEGACY_DURESS_PIN_RECORD_KEY_ID)
    return { migrated: true }
}

/**
 * Merges the legacy v2 `pera.pinCode` record and the separate
 * `pera.duressPinCode` record into the single fixed-shape v3 record, and
 * deletes the legacy duress entry — its key id sits in the keystore's
 * plaintext metadata bucket, where it read as "this user has a duress PIN".
 * Idempotent, and concurrent callers share one run (two interleaved runs
 * could each re-randomize the duress slot after the other removed the legacy
 * record, silently dropping the configured duress PIN).
 */
export const migratePinRecordToV3 = (
    kms: KmsAccess,
): Promise<PinRecordMigrationResult> => {
    if (!inflight) {
        inflight = runMigration(kms).finally(() => {
            inflight = null
        })
    }
    return inflight
}

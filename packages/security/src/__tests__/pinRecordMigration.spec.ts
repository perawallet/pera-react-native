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

import { describe, test, expect, beforeEach, vi } from 'vitest'
import {
    createPinRecord,
    parsePinRecord,
    serializePinRecord,
    verifyPinAgainstDuressSlot,
    verifyPinAgainstRecord,
    type PinRecord,
} from '../pinRecord'
import { migratePinRecordToV3 } from '../pinRecordMigration'
import {
    PIN_RECORD_KEY_ID,
    LEGACY_DURESS_PIN_RECORD_KEY_ID,
} from '../constants'

const encoder = new TextEncoder()

// The legacy v2 shape: same PBKDF2 slot, no duress fields. Built from a v3
// record so the salt/hash are a real PBKDF2 pair for the given PIN.
const legacyV2Bytes = (
    record: PinRecord,
    overrides: Partial<Record<string, unknown>> = {},
): Uint8Array =>
    encoder.encode(
        JSON.stringify({
            version: 2,
            salt: record.salt,
            hash: record.hash,
            failedAttempts: record.failedAttempts,
            lockoutEndTime: record.lockoutEndTime,
            ...overrides,
        }),
    )

describe('migratePinRecordToV3', () => {
    let store: Map<string, Uint8Array>
    let commitSecret: ReturnType<typeof vi.fn>
    let removeSecret: ReturnType<typeof vi.fn>

    const kms = () => ({
        withSecret: async <T>(
            id: string,
            handler: (bytes: Uint8Array) => T | Promise<T>,
        ): Promise<T | null> => {
            const stash = store.get(id)
            if (!stash) return null
            const bytes = new Uint8Array(stash)
            try {
                return await handler(bytes)
            } finally {
                bytes.fill(0)
            }
        },
        commitSecret: commitSecret as unknown as (params: {
            id: string
            bytes: Uint8Array
        }) => Promise<void>,
        removeSecret: removeSecret as unknown as (id: string) => Promise<void>,
    })

    beforeEach(() => {
        store = new Map()
        commitSecret = vi.fn(
            async ({ id, bytes }: { id: string; bytes: Uint8Array }) => {
                store.set(id, new Uint8Array(bytes))
            },
        )
        removeSecret = vi.fn(async (id: string) => {
            store.delete(id)
        })
    })

    test('merges a v2 record and a legacy duress record into one v3 record', async () => {
        const regular = await createPinRecord('123456')
        const duress = await createPinRecord('111111')
        store.set(
            PIN_RECORD_KEY_ID,
            legacyV2Bytes({
                ...regular,
                failedAttempts: 3,
                lockoutEndTime: 42,
            }),
        )
        store.set(LEGACY_DURESS_PIN_RECORD_KEY_ID, legacyV2Bytes(duress))

        const result = await migratePinRecordToV3(kms())

        expect(result).toEqual({ migrated: true })
        expect(store.has(LEGACY_DURESS_PIN_RECORD_KEY_ID)).toBe(false)
        const migrated = parsePinRecord(store.get(PIN_RECORD_KEY_ID)!)
        expect(migrated).not.toBeNull()
        expect(migrated!.duressEnabled).toBe(1)
        expect(migrated!.failedAttempts).toBe(3)
        expect(migrated!.lockoutEndTime).toBe(42)
        await expect(verifyPinAgainstRecord('123456', migrated!)).resolves.toBe(
            true,
        )
        await expect(
            verifyPinAgainstDuressSlot('111111', migrated!),
        ).resolves.toBe(true)
    }, 60_000)

    test('migrates a v2 record without duress to v3 with a disarmed random slot', async () => {
        const regular = await createPinRecord('123456')
        store.set(PIN_RECORD_KEY_ID, legacyV2Bytes(regular))

        const result = await migratePinRecordToV3(kms())

        expect(result).toEqual({ migrated: true })
        const migrated = parsePinRecord(store.get(PIN_RECORD_KEY_ID)!)
        expect(migrated).not.toBeNull()
        expect(migrated!.duressEnabled).toBe(0)
        expect(migrated!.duressSalt).toMatch(/^[0-9a-f]{32}$/)
        expect(migrated!.duressHash).toMatch(/^[0-9a-f]{64}$/)
        await expect(verifyPinAgainstRecord('123456', migrated!)).resolves.toBe(
            true,
        )
    }, 60_000)

    test('leaves a v3 record untouched but still removes a stray legacy duress record', async () => {
        const v3 = await createPinRecord('123456')
        const bytes = serializePinRecord(v3)
        store.set(PIN_RECORD_KEY_ID, bytes)
        store.set(
            LEGACY_DURESS_PIN_RECORD_KEY_ID,
            legacyV2Bytes(await createPinRecord('111111')),
        )

        const result = await migratePinRecordToV3(kms())

        expect(result).toEqual({ migrated: false })
        expect(commitSecret).not.toHaveBeenCalled()
        expect(store.get(PIN_RECORD_KEY_ID)).toEqual(bytes)
        expect(store.has(LEGACY_DURESS_PIN_RECORD_KEY_ID)).toBe(false)
    }, 30_000)

    test('removes an orphaned legacy duress record when no PIN record exists', async () => {
        store.set(
            LEGACY_DURESS_PIN_RECORD_KEY_ID,
            legacyV2Bytes(await createPinRecord('111111')),
        )

        const result = await migratePinRecordToV3(kms())

        expect(result).toEqual({ migrated: false })
        expect(commitSecret).not.toHaveBeenCalled()
        expect(store.has(PIN_RECORD_KEY_ID)).toBe(false)
        expect(store.has(LEGACY_DURESS_PIN_RECORD_KEY_ID)).toBe(false)
    }, 30_000)

    test('an unparseable legacy duress record migrates to a disarmed slot and is removed', async () => {
        const regular = await createPinRecord('123456')
        store.set(PIN_RECORD_KEY_ID, legacyV2Bytes(regular))
        store.set(LEGACY_DURESS_PIN_RECORD_KEY_ID, encoder.encode('corrupted'))

        const result = await migratePinRecordToV3(kms())

        expect(result).toEqual({ migrated: true })
        const migrated = parsePinRecord(store.get(PIN_RECORD_KEY_ID)!)
        expect(migrated!.duressEnabled).toBe(0)
        expect(store.has(LEGACY_DURESS_PIN_RECORD_KEY_ID)).toBe(false)
    }, 30_000)

    test('a legacy duress record with a tampered hash is dropped, not armed', async () => {
        const regular = await createPinRecord('123456')
        const duress = await createPinRecord('111111')
        store.set(PIN_RECORD_KEY_ID, legacyV2Bytes(regular))
        store.set(
            LEGACY_DURESS_PIN_RECORD_KEY_ID,
            legacyV2Bytes(duress, { hash: 'z'.repeat(64) }),
        )

        const result = await migratePinRecordToV3(kms())

        expect(result).toEqual({ migrated: true })
        const migrated = parsePinRecord(store.get(PIN_RECORD_KEY_ID)!)
        expect(migrated!.duressEnabled).toBe(0)
    }, 30_000)

    test('concurrent calls share one migration run', async () => {
        const regular = await createPinRecord('123456')
        store.set(PIN_RECORD_KEY_ID, legacyV2Bytes(regular))

        const access = kms()
        const [a, b] = await Promise.all([
            migratePinRecordToV3(access),
            migratePinRecordToV3(access),
        ])

        expect(a).toEqual({ migrated: true })
        expect(b).toEqual({ migrated: true })
        expect(commitSecret).toHaveBeenCalledTimes(1)
    }, 60_000)
})

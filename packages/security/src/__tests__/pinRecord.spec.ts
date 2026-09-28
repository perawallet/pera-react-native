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

import { describe, test, expect } from 'vitest'
import {
    PIN_RECORD_VERSION,
    applyDuressPin,
    constantTimeEqual,
    createPinRecord,
    parsePinRecord,
    serializePinRecord,
    verifyPinAgainstDuressSlot,
    verifyPinAgainstRecord,
} from '../pinRecord'

describe('pinRecord', () => {
    test('createPinRecord produces versioned record with random salt/hash', async () => {
        const a = await createPinRecord('123456')
        const b = await createPinRecord('123456')

        expect(a.version).toBe(PIN_RECORD_VERSION)
        expect(a.failedAttempts).toBe(0)
        expect(a.lockoutEndTime).toBeNull()
        expect(a.salt).toMatch(/^[0-9a-f]{32}$/)
        expect(a.hash).toMatch(/^[0-9a-f]{64}$/)
        // Same PIN twice still produces different salts, therefore different hashes.
        expect(a.salt).not.toBe(b.salt)
        expect(a.hash).not.toBe(b.hash)
    }, 30_000)

    test('createPinRecord fills the duress slot with random bytes, flag off', async () => {
        const a = await createPinRecord('123456')
        const b = await createPinRecord('123456')

        expect(a.duressEnabled).toBe(0)
        expect(a.duressSalt).toMatch(/^[0-9a-f]{32}$/)
        expect(a.duressHash).toMatch(/^[0-9a-f]{64}$/)
        // Random fill, not a fixed sentinel — two records must differ.
        expect(a.duressSalt).not.toBe(b.duressSalt)
        expect(a.duressHash).not.toBe(b.duressHash)
    }, 30_000)

    test('verifyPinAgainstRecord accepts correct PIN and rejects wrong PIN', async () => {
        const record = await createPinRecord('123456')
        await expect(verifyPinAgainstRecord('123456', record)).resolves.toBe(
            true,
        )
        await expect(verifyPinAgainstRecord('654321', record)).resolves.toBe(
            false,
        )
    }, 30_000)

    test('applyDuressPin arms the duress slot without touching the regular slot', async () => {
        const base = await createPinRecord('123456')
        const armed = await applyDuressPin(base, '111111')

        expect(armed.duressEnabled).toBe(1)
        expect(armed.salt).toBe(base.salt)
        expect(armed.hash).toBe(base.hash)
        await expect(verifyPinAgainstRecord('123456', armed)).resolves.toBe(
            true,
        )
        await expect(verifyPinAgainstDuressSlot('111111', armed)).resolves.toBe(
            true,
        )
        await expect(verifyPinAgainstDuressSlot('999999', armed)).resolves.toBe(
            false,
        )
    }, 60_000)

    test('applyDuressPin(null) disarms and re-randomizes the duress slot', async () => {
        const base = await createPinRecord('123456')
        const armed = await applyDuressPin(base, '111111')
        const disarmed = await applyDuressPin(armed, null)

        expect(disarmed.duressEnabled).toBe(0)
        expect(disarmed.duressSalt).not.toBe(armed.duressSalt)
        expect(disarmed.duressHash).not.toBe(armed.duressHash)
        await expect(
            verifyPinAgainstDuressSlot('111111', disarmed),
        ).resolves.toBe(false)
    }, 60_000)

    test('verifyPinAgainstDuressSlot is gated by the flag, not just the hash', async () => {
        // Even if the slot's hash would match, a disarmed flag means no duress
        // PIN is configured — the random-fill slot must never grant access.
        const armed = await applyDuressPin(
            await createPinRecord('123456'),
            '111111',
        )
        const flagOff = { ...armed, duressEnabled: 0 as const }
        await expect(
            verifyPinAgainstDuressSlot('111111', flagOff),
        ).resolves.toBe(false)
    }, 60_000)

    test('serialized size is identical whether or not a duress PIN is set', async () => {
        // The keystore payload is encrypted, but ciphertext length tracks
        // plaintext length — a size difference would leak the flag.
        const without = await createPinRecord('123456')
        const withDuress = await applyDuressPin(without, '111111')
        expect(serializePinRecord(withDuress).length).toBe(
            serializePinRecord(without).length,
        )
    }, 60_000)

    test('serializePinRecord/parsePinRecord round-trip (duress fields included)', async () => {
        const record = await applyDuressPin(
            await createPinRecord('000000'),
            '111111',
        )
        const serialized = serializePinRecord({
            ...record,
            failedAttempts: 2,
            lockoutEndTime: 1234567890,
        })
        const parsed = parsePinRecord(serialized)
        expect(parsed).toEqual({
            ...record,
            failedAttempts: 2,
            lockoutEndTime: 1234567890,
        })
    }, 60_000)

    test('parsePinRecord returns null for invalid or wrong-version data', () => {
        const encoder = new TextEncoder()
        expect(parsePinRecord(encoder.encode('not json'))).toBeNull()
        expect(parsePinRecord(encoder.encode('{}'))).toBeNull()
        expect(
            parsePinRecord(
                encoder.encode(
                    JSON.stringify({
                        version: 99,
                        salt: 'a',
                        hash: 'b',
                        failedAttempts: 0,
                        lockoutEndTime: null,
                    }),
                ),
            ),
        ).toBeNull()
    })

    test('parsePinRecord rejects the legacy v2 shape (no duress slot)', async () => {
        const base = await createPinRecord('000000')
        const encoder = new TextEncoder()
        const legacyV2 = {
            version: 2,
            salt: base.salt,
            hash: base.hash,
            failedAttempts: 0,
            lockoutEndTime: null,
        }
        expect(
            parsePinRecord(encoder.encode(JSON.stringify(legacyV2))),
        ).toBeNull()
    }, 30_000)

    test('parsePinRecord rejects out-of-range / non-integer numeric fields', async () => {
        const base = await createPinRecord('000000')
        const encoder = new TextEncoder()
        const bytesWith = (overrides: Record<string, unknown>) =>
            encoder.encode(JSON.stringify({ ...base, ...overrides }))

        expect(parsePinRecord(bytesWith({ failedAttempts: -1 }))).toBeNull()
        expect(parsePinRecord(bytesWith({ failedAttempts: 1.5 }))).toBeNull()
        expect(parsePinRecord(bytesWith({ lockoutEndTime: -5 }))).toBeNull()
        expect(parsePinRecord(bytesWith({ lockoutEndTime: 1.5 }))).toBeNull()
    }, 30_000)

    test('parsePinRecord rejects malformed or wrong-length salt/hash in either slot', async () => {
        const base = await createPinRecord('000000')
        const encoder = new TextEncoder()
        const bytesWith = (overrides: Record<string, unknown>) =>
            encoder.encode(JSON.stringify({ ...base, ...overrides }))

        // non-hex characters, correct length
        expect(parsePinRecord(bytesWith({ salt: 'z'.repeat(32) }))).toBeNull()
        expect(parsePinRecord(bytesWith({ hash: 'z'.repeat(64) }))).toBeNull()
        expect(
            parsePinRecord(bytesWith({ duressSalt: 'z'.repeat(32) })),
        ).toBeNull()
        expect(
            parsePinRecord(bytesWith({ duressHash: 'z'.repeat(64) })),
        ).toBeNull()
        // valid hex, wrong length
        expect(
            parsePinRecord(bytesWith({ salt: base.salt.slice(0, 30) })),
        ).toBeNull()
        expect(
            parsePinRecord(bytesWith({ hash: base.hash.slice(0, 62) })),
        ).toBeNull()
        expect(
            parsePinRecord(
                bytesWith({ duressSalt: base.duressSalt.slice(0, 30) }),
            ),
        ).toBeNull()
        expect(
            parsePinRecord(
                bytesWith({ duressHash: base.duressHash.slice(0, 62) }),
            ),
        ).toBeNull()
    }, 30_000)

    test('parsePinRecord rejects non-0/1 duressEnabled values', async () => {
        const base = await createPinRecord('000000')
        const encoder = new TextEncoder()
        const bytesWith = (overrides: Record<string, unknown>) =>
            encoder.encode(JSON.stringify({ ...base, ...overrides }))

        expect(parsePinRecord(bytesWith({ duressEnabled: true }))).toBeNull()
        expect(parsePinRecord(bytesWith({ duressEnabled: '1' }))).toBeNull()
        expect(parsePinRecord(bytesWith({ duressEnabled: 2 }))).toBeNull()
        expect(parsePinRecord(bytesWith({ duressEnabled: -1 }))).toBeNull()
    }, 30_000)

    test('constantTimeEqual returns true only for identical byte sequences', () => {
        expect(
            constantTimeEqual(
                new Uint8Array([1, 2, 3]),
                new Uint8Array([1, 2, 3]),
            ),
        ).toBe(true)
        expect(
            constantTimeEqual(
                new Uint8Array([1, 2, 3]),
                new Uint8Array([1, 2, 4]),
            ),
        ).toBe(false)
        expect(
            constantTimeEqual(
                new Uint8Array([1, 2]),
                new Uint8Array([1, 2, 3]),
            ),
        ).toBe(false)
    })
})

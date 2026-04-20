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

import { describe, test, expect } from 'vitest'
import {
    PIN_RECORD_VERSION,
    constantTimeEqual,
    constantTimeStringEqual,
    createPinRecord,
    decodeLegacyPin,
    isLegacyPinData,
    parsePinRecord,
    serializePinRecord,
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

    test('verifyPinAgainstRecord accepts correct PIN and rejects wrong PIN', async () => {
        const record = await createPinRecord('123456')
        await expect(verifyPinAgainstRecord('123456', record)).resolves.toBe(
            true,
        )
        await expect(verifyPinAgainstRecord('654321', record)).resolves.toBe(
            false,
        )
    }, 30_000)

    test('serializePinRecord/parsePinRecord round-trip', async () => {
        const record = await createPinRecord('000000')
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
    }, 30_000)

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

    test('isLegacyPinData detects raw-PIN byte format vs JSON envelope', () => {
        const encoder = new TextEncoder()
        expect(isLegacyPinData(encoder.encode('123456'))).toBe(true)
        expect(
            isLegacyPinData(
                encoder.encode(
                    `{"version":${PIN_RECORD_VERSION},"salt":"","hash":"","failedAttempts":0,"lockoutEndTime":null}`,
                ),
            ),
        ).toBe(false)
    })

    test('decodeLegacyPin returns the stored PIN string', () => {
        const encoder = new TextEncoder()
        expect(decodeLegacyPin(encoder.encode('987654'))).toBe('987654')
    })

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

    test('constantTimeStringEqual returns true only for identical strings', () => {
        expect(constantTimeStringEqual('abc', 'abc')).toBe(true)
        expect(constantTimeStringEqual('abc', 'abd')).toBe(false)
        expect(constantTimeStringEqual('abc', 'abcd')).toBe(false)
    })
})

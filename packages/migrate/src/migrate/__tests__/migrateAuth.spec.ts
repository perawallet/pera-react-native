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

import { describe, it, expect, vi, beforeEach } from 'vitest'

const PIN_KEY = 'pera.pinCode'
const BIO_KEY = 'pera.biometricPinCode'

const { commitSecretMock, withSecretMock } = vi.hoisted(() => ({
    commitSecretMock: vi.fn(),
    withSecretMock: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-security', () => ({
    PIN_RECORD_KEY_ID: 'pera.pinCode',
    BIOMETRIC_BLOB_KEY_ID: 'pera.biometricPinCode',
    createPinRecord: vi.fn(async (pin: string) => ({
        version: 1,
        salt: 'salt-' + pin,
        hash: 'hash-' + pin,
        failedAttempts: 0,
        lockoutEndTime: null,
    })),
    serializePinRecord: vi.fn(
        (r: unknown) => `serialized:${JSON.stringify(r)}`,
    ),
}))

vi.mock('@perawallet/wallet-core-kms', () => ({
    commitSecret: commitSecretMock,
    withSecret: withSecretMock,
}))

import {
    createPinRecord,
    serializePinRecord,
} from '@perawallet/wallet-core-security'
import type {
    LegacyAuth,
    LegacyPreferences,
} from '@perawallet/wallet-extension-platform'
import { migrateAuth } from '../migrateAuth'

const buildPreferences = (
    overrides: Partial<LegacyPreferences> = {},
): LegacyPreferences =>
    ({
        biometricEnabled: false,
        lockAttemptCount: null,
        lockPenaltyRemainingMs: null,
        rawFlags: {},
        ...overrides,
    }) as LegacyPreferences

const encodePin = (pin: string): Uint8Array => new TextEncoder().encode(pin)

const commitCallFor = (id: string) =>
    commitSecretMock.mock.calls.find(c => c[0].id === id)

beforeEach(() => {
    vi.mocked(createPinRecord).mockClear()
    vi.mocked(serializePinRecord).mockClear()
    commitSecretMock.mockReset()
    withSecretMock.mockReset()
    withSecretMock.mockResolvedValue(null)
    commitSecretMock.mockResolvedValue(undefined)
})

describe('migrateAuth', () => {
    it('returns all-false when pin is null', async () => {
        const auth = { pin: null } as LegacyAuth

        const result = await migrateAuth(auth, buildPreferences())

        expect(result).toEqual({
            pinMigrated: false,
            biometricMigrated: false,
            lockoutMigrated: false,
        })
        expect(withSecretMock).not.toHaveBeenCalled()
        expect(createPinRecord).not.toHaveBeenCalled()
    })

    it('returns all-false when pin is empty', async () => {
        const auth: LegacyAuth = { pin: new Uint8Array(0) }

        const result = await migrateAuth(auth, buildPreferences())

        expect(result.pinMigrated).toBe(false)
        expect(withSecretMock).not.toHaveBeenCalled()
    })

    it('skips when a PIN is already stored', async () => {
        withSecretMock.mockResolvedValueOnce(true)
        const auth: LegacyAuth = { pin: encodePin('1234') }

        const result = await migrateAuth(auth, buildPreferences())

        expect(result.pinMigrated).toBe(false)
        expect(withSecretMock).toHaveBeenCalledWith(
            PIN_KEY,
            expect.any(Function),
        )
        expect(createPinRecord).not.toHaveBeenCalled()
        expect(commitSecretMock).not.toHaveBeenCalled()
    })

    it('hashes the decoded pin and persists the serialized record', async () => {
        const auth: LegacyAuth = { pin: encodePin('5678') }

        const result = await migrateAuth(auth, buildPreferences())

        expect(createPinRecord).toHaveBeenCalledWith('5678')
        const pinWrite = commitCallFor(PIN_KEY)
        expect(pinWrite).toBeDefined()
        expect(pinWrite?.[0].bytes).toContain('serialized:')
        expect(result.pinMigrated).toBe(true)
    })

    it('applies failedAttempts and lockoutEndTime from preferences', async () => {
        const auth: LegacyAuth = { pin: encodePin('9999') }
        const preferences = buildPreferences({
            lockAttemptCount: 3,
            lockPenaltyRemainingMs: 60_000,
        })
        const dateSpy = vi.spyOn(Date, 'now').mockReturnValue(1_000_000)

        const result = await migrateAuth(auth, preferences)

        expect(result.lockoutMigrated).toBe(true)
        const recordArg = vi.mocked(serializePinRecord).mock.calls[0][0] as {
            failedAttempts: number
            lockoutEndTime: number | null
        }
        expect(recordArg.failedAttempts).toBe(3)
        expect(recordArg.lockoutEndTime).toBe(1_060_000)

        dateSpy.mockRestore()
    })

    it('ignores non-positive lockPenaltyRemainingMs', async () => {
        const auth: LegacyAuth = { pin: encodePin('1111') }
        const preferences = buildPreferences({
            lockAttemptCount: null,
            lockPenaltyRemainingMs: 0,
        })

        const result = await migrateAuth(auth, preferences)

        expect(result.lockoutMigrated).toBe(false)
        const recordArg = vi.mocked(serializePinRecord).mock.calls[0][0] as {
            lockoutEndTime: number | null
        }
        expect(recordArg.lockoutEndTime).toBeNull()
    })

    it('writes the serialized pin record to the biometric blob when biometricEnabled is true', async () => {
        const pinBytes = encodePin('2468')
        const auth: LegacyAuth = { pin: pinBytes }
        const preferences = buildPreferences({ biometricEnabled: true })

        const result = await migrateAuth(auth, preferences)

        expect(result.biometricMigrated).toBe(true)
        const bioWrite = commitCallFor(BIO_KEY)
        expect(bioWrite?.[0].bytes).toContain('serialized:')
    })

    it('skips the biometric write when biometricEnabled is not true', async () => {
        const auth: LegacyAuth = { pin: encodePin('3690') }

        const result = await migrateAuth(
            auth,
            buildPreferences({ biometricEnabled: null }),
        )

        expect(result.biometricMigrated).toBe(false)
        expect(commitCallFor(BIO_KEY)).toBeUndefined()
    })

    it('zeroes the pin bytes after migration succeeds', async () => {
        const pinBytes = encodePin('7777')
        const auth: LegacyAuth = { pin: pinBytes }

        await migrateAuth(auth, buildPreferences())

        expect(Array.from(pinBytes)).toEqual(Array(pinBytes.length).fill(0))
    })

    it('zeroes the pin bytes even when commitSecret throws', async () => {
        const pinBytes = encodePin('5555')
        const auth: LegacyAuth = { pin: pinBytes }
        commitSecretMock.mockRejectedValueOnce(new Error('disk full'))

        await expect(migrateAuth(auth, buildPreferences())).rejects.toThrow(
            'disk full',
        )
        expect(Array.from(pinBytes)).toEqual(Array(pinBytes.length).fill(0))
    })
})

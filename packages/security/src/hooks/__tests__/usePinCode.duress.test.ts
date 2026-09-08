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
import { renderHook, act, waitFor } from '@testing-library/react'
// Wrap the two slot verifications so tests can count hashing work — the
// deniability property is "the PBKDF2 work per attempt never depends on
// whether a duress PIN is configured", and each of these runs exactly one
// PBKDF2 (the duress one unconditionally; see pinRecord.ts).
vi.mock('../../pinRecord', async importOriginal => {
    const actual = await importOriginal<typeof import('../../pinRecord')>()
    return {
        ...actual,
        verifyPinAgainstRecord: vi.fn(actual.verifyPinAgainstRecord),
        verifyPinAgainstDuressSlot: vi.fn(actual.verifyPinAgainstDuressSlot),
    }
})

const kmsMocks = vi.hoisted(() => ({
    pinBytes: null as Uint8Array | null,
    legacyDuressBytes: null as Uint8Array | null,
    biometricBytes: null as Uint8Array | null,
    commitSecret: vi.fn(),
    withSecret: vi.fn(),
    hasSecret: vi.fn(),
    removeSecret: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-kms', () => ({
    useKMSService: () => ({
        commitSecret: kmsMocks.commitSecret,
        withSecret: kmsMocks.withSecret,
        hasSecret: kmsMocks.hasSecret,
        removeSecret: kmsMocks.removeSecret,
    }),
    zeroBytes: (...buffers: Array<Uint8Array | undefined | null>) => {
        for (const buf of buffers) if (buf) buf.fill(0)
    },
}))

import { usePinCode } from '../usePinCode'
import { useBiometrics } from '../useBiometrics'
import { useSecurityStore } from '../../store'
import {
    PIN_RECORD_KEY_ID,
    LEGACY_DURESS_PIN_RECORD_KEY_ID,
} from '../../constants'
import {
    createPinRecord,
    parsePinRecord,
    verifyPinAgainstDuressSlot,
    verifyPinAgainstRecord,
    type PinRecord,
} from '../../pinRecord'

vi.mock('../../store', () => ({
    useSecurityStore: vi.fn(),
}))

vi.mock('../useBiometrics', () => ({
    useBiometrics: vi.fn(() => ({
        checkBiometricsEnabled: vi.fn().mockResolvedValue(false),
        disableBiometrics: vi.fn(),
    })),
}))

const wireBlobMocks = () => {
    kmsMocks.commitSecret.mockImplementation(
        async ({ id, bytes }: { id: string; bytes: Uint8Array }) => {
            const copy = new Uint8Array(bytes)
            if (id === PIN_RECORD_KEY_ID) kmsMocks.pinBytes = copy
            else if (id === LEGACY_DURESS_PIN_RECORD_KEY_ID)
                kmsMocks.legacyDuressBytes = copy
            else kmsMocks.biometricBytes = copy
        },
    )
    kmsMocks.withSecret.mockImplementation(
        async (id: string, handler: (bytes: Uint8Array) => unknown) => {
            const stash =
                id === PIN_RECORD_KEY_ID
                    ? kmsMocks.pinBytes
                    : id === LEGACY_DURESS_PIN_RECORD_KEY_ID
                      ? kmsMocks.legacyDuressBytes
                      : kmsMocks.biometricBytes
            if (!stash) return null
            const bytes = new Uint8Array(stash)
            try {
                return await handler(bytes)
            } finally {
                bytes.fill(0)
            }
        },
    )
    kmsMocks.hasSecret.mockImplementation((id: string) =>
        id === PIN_RECORD_KEY_ID
            ? kmsMocks.pinBytes !== null
            : id === LEGACY_DURESS_PIN_RECORD_KEY_ID
              ? kmsMocks.legacyDuressBytes !== null
              : kmsMocks.biometricBytes !== null,
    )
    kmsMocks.removeSecret.mockImplementation(async (id: string) => {
        if (id === PIN_RECORD_KEY_ID) kmsMocks.pinBytes = null
        else if (id === LEGACY_DURESS_PIN_RECORD_KEY_ID)
            kmsMocks.legacyDuressBytes = null
        else kmsMocks.biometricBytes = null
    })
}

const encoder = new TextEncoder()
const legacyV2Bytes = (record: PinRecord): Uint8Array =>
    encoder.encode(
        JSON.stringify({
            version: 2,
            salt: record.salt,
            hash: record.hash,
            failedAttempts: record.failedAttempts,
            lockoutEndTime: record.lockoutEndTime,
        }),
    )

const currentPinRecord = () => parsePinRecord(kmsMocks.pinBytes!)

describe('usePinCode — duress slot', () => {
    const mockSetFailedAttempts = vi.fn()
    const mockResetFailedAttempts = vi.fn()
    const mockSetLockoutEndTime = vi.fn()
    const mockSetAutoLockStartedAt = vi.fn()

    beforeEach(() => {
        vi.clearAllMocks()
        kmsMocks.pinBytes = null
        kmsMocks.legacyDuressBytes = null
        kmsMocks.biometricBytes = null
        wireBlobMocks()
        // Default store wiring — overridable per test.
        ;(
            useSecurityStore as unknown as ReturnType<typeof vi.fn>
        ).mockImplementation(
            (selector: (state: Record<string, unknown>) => unknown) =>
                selector({
                    failedAttempts: 0,
                    lockoutEndTime: null,
                    autoLockStartedAt: null,
                    setFailedAttempts: mockSetFailedAttempts,
                    resetFailedAttempts: mockResetFailedAttempts,
                    setLockoutEndTime: mockSetLockoutEndTime,
                    setAutoLockStartedAt: mockSetAutoLockStartedAt,
                }),
        )
    })

    test('saveDuressPin arms the slot inside the single PIN record — no second keystore entry', async () => {
        const { result } = renderHook(() => usePinCode())
        await act(async () => {
            await result.current.savePin('123456')
            await result.current.saveDuressPin('111111')
        })

        expect(kmsMocks.legacyDuressBytes).toBeNull()
        const record = currentPinRecord()
        expect(record?.duressEnabled).toBe(1)
        // The regular PIN still verifies against the same record.
        let outcome
        await act(async () => {
            outcome = await result.current.verifyPin('123456')
        })
        expect(outcome).toEqual({ kind: 'ok' })
    }, 60_000)

    test('saveDuressPin throws when no regular PIN record exists', async () => {
        const { result } = renderHook(() => usePinCode())
        await expect(result.current.saveDuressPin('111111')).rejects.toThrow()
        expect(kmsMocks.pinBytes).toBeNull()
        expect(kmsMocks.legacyDuressBytes).toBeNull()
    }, 30_000)

    test('checkDuressPinEnabled reflects the record flag through arm/disarm', async () => {
        const { result } = renderHook(() => usePinCode())
        await act(async () => {
            await result.current.savePin('123456')
        })
        expect(await result.current.checkDuressPinEnabled()).toBe(false)

        await act(async () => {
            await result.current.saveDuressPin('111111')
        })
        expect(await result.current.checkDuressPinEnabled()).toBe(true)

        await act(async () => {
            await result.current.saveDuressPin(null)
        })
        expect(await result.current.checkDuressPinEnabled()).toBe(false)
        // Disarming keeps the record present and shaped identically.
        expect(currentPinRecord()?.duressEnabled).toBe(0)
    }, 60_000)

    test('changing the regular PIN preserves an armed duress PIN', async () => {
        const { result } = renderHook(() => usePinCode())
        await act(async () => {
            await result.current.savePin('123456')
            await result.current.saveDuressPin('111111')
            await result.current.savePin('654321')
        })

        let regular, duress
        await act(async () => {
            regular = await result.current.verifyPin('654321')
            duress = await result.current.verifyPin('111111')
        })
        expect(regular).toEqual({ kind: 'ok' })
        expect(duress).toEqual({ kind: 'duress' })
    }, 60_000)

    test('savePin(null) removes the record, taking the duress slot with it', async () => {
        const { result } = renderHook(() => usePinCode())
        await act(async () => {
            await result.current.savePin('123456')
            await result.current.saveDuressPin('111111')
        })
        expect(await result.current.checkDuressPinEnabled()).toBe(true)

        await act(async () => {
            await result.current.savePin(null)
        })

        expect(kmsMocks.pinBytes).toBeNull()
        expect(await result.current.checkDuressPinEnabled()).toBe(false)
    }, 60_000)

    test('verifyPin returns `ok` for the regular PIN even when duress is armed', async () => {
        const { result } = renderHook(() => usePinCode())
        await act(async () => {
            await result.current.savePin('123456')
            await result.current.saveDuressPin('111111')
        })

        let outcome
        await act(async () => {
            outcome = await result.current.verifyPin('123456')
        })
        expect(outcome).toEqual({ kind: 'ok' })
    }, 60_000)

    test('verifyPin returns `duress` when the entered PIN matches the duress slot', async () => {
        const { result } = renderHook(() => usePinCode())
        await act(async () => {
            await result.current.savePin('123456')
            await result.current.saveDuressPin('111111')
        })

        let outcome
        await act(async () => {
            outcome = await result.current.verifyPin('111111')
        })
        expect(outcome).toEqual({ kind: 'duress' })
    }, 60_000)

    test('verifyPin returns `fail` when neither slot matches', async () => {
        const { result } = renderHook(() => usePinCode())
        await act(async () => {
            await result.current.savePin('123456')
            await result.current.saveDuressPin('111111')
        })

        let outcome
        await act(async () => {
            outcome = await result.current.verifyPin('999999')
        })
        expect(outcome).toEqual({ kind: 'fail' })
    }, 60_000)

    test('every attempt verifies both slots — same work with or without a duress PIN, on success or failure', async () => {
        const regularSpy = vi.mocked(verifyPinAgainstRecord)
        const duressSpy = vi.mocked(verifyPinAgainstDuressSlot)
        const clearSpies = () => {
            regularSpy.mockClear()
            duressSpy.mockClear()
        }

        const { result } = renderHook(() => usePinCode())
        await act(async () => {
            await result.current.savePin('123456')
        })

        // Wrong PIN, duress not configured.
        clearSpies()
        await act(async () => {
            await result.current.verifyPin('999999')
        })
        expect(regularSpy).toHaveBeenCalledTimes(1)
        expect(duressSpy).toHaveBeenCalledTimes(1)

        // Correct PIN — no short-circuit: a duress unlock must not be
        // distinguishable from a normal one by its duration.
        clearSpies()
        await act(async () => {
            await result.current.verifyPin('123456')
        })
        expect(regularSpy).toHaveBeenCalledTimes(1)
        expect(duressSpy).toHaveBeenCalledTimes(1)

        // Wrong PIN, duress configured: identical call pattern.
        await act(async () => {
            await result.current.saveDuressPin('111111')
        })
        clearSpies()
        await act(async () => {
            await result.current.verifyPin('999999')
        })
        expect(regularSpy).toHaveBeenCalledTimes(1)
        expect(duressSpy).toHaveBeenCalledTimes(1)
    }, 60_000)

    test('duress comparison bypasses the lockout gate (still returns `duress` when locked out)', async () => {
        // Lockout end time is in the future — but the duress path must
        // still return `duress`, because otherwise an attacker could lock
        // the user out and demand the regular PIN with no escape hatch.
        ;(
            useSecurityStore as unknown as ReturnType<typeof vi.fn>
        ).mockImplementation(
            (selector: (state: Record<string, unknown>) => unknown) =>
                selector({
                    failedAttempts: 5,
                    lockoutEndTime: Date.now() + 60_000,
                    autoLockStartedAt: null,
                    setFailedAttempts: mockSetFailedAttempts,
                    resetFailedAttempts: mockResetFailedAttempts,
                    setLockoutEndTime: mockSetLockoutEndTime,
                    setAutoLockStartedAt: mockSetAutoLockStartedAt,
                }),
        )

        const { result } = renderHook(() => usePinCode())
        await act(async () => {
            await result.current.savePin('123456')
            await result.current.saveDuressPin('111111')
        })

        let outcome
        await act(async () => {
            outcome = await result.current.verifyPin('111111')
        })
        expect(outcome).toEqual({ kind: 'duress' })
    }, 60_000)

    test('mounting migrates a legacy v2 record + separate duress record into one v3 record', async () => {
        const regular = await createPinRecord('123456')
        const duress = await createPinRecord('111111')
        kmsMocks.pinBytes = legacyV2Bytes(regular)
        kmsMocks.legacyDuressBytes = legacyV2Bytes(duress)

        vi.mocked(useBiometrics).mockReturnValue({
            checkBiometricsEnabled: vi.fn().mockResolvedValue(true),
            disableBiometrics: vi.fn(),
        } as unknown as ReturnType<typeof useBiometrics>)

        const { result } = renderHook(() => usePinCode())

        await waitFor(() => {
            expect(kmsMocks.legacyDuressBytes).toBeNull()
            expect(currentPinRecord()?.duressEnabled).toBe(1)
        })
        let regularOutcome, duressOutcome
        await act(async () => {
            regularOutcome = await result.current.verifyPin('123456')
            duressOutcome = await result.current.verifyPin('111111')
        })
        expect(regularOutcome).toEqual({ kind: 'ok' })
        expect(duressOutcome).toEqual({ kind: 'duress' })
    }, 60_000)
})

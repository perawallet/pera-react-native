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

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

const kmsMocks = vi.hoisted(() => ({
    pinBytes: null as Uint8Array | null,
    duressPinBytes: null as Uint8Array | null,
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
    // pinRecord.ts (transitively imported by usePinCode) calls
    // `zeroBytes` from this module inside the PBKDF2 callback. Without
    // it the callback throws as an uncaught exception and savePin /
    // verifyPin hang forever.
    zeroBytes: (...buffers: Array<Uint8Array | undefined | null>) => {
        for (const buf of buffers) {
            if (buf) buf.fill(0)
        }
    },
}))

import { usePinCode } from '../usePinCode'
import { useSecurityStore } from '../../store'
import {
    PIN_RECORD_KEY_ID,
    DURESS_PIN_RECORD_KEY_ID,
    MAX_PIN_ATTEMPTS_BEFORE_LOCKOUT,
    INITIAL_LOCKOUT_SECONDS,
} from '../../constants'
import type { Nullable } from '@perawallet/wallet-core-shared'
import {
    PIN_RECORD_VERSION,
    createPinRecord,
    parsePinRecord,
    serializePinRecord,
} from '../../pinRecord'

vi.mock('../../store', () => ({
    useSecurityStore: vi.fn(),
}))

vi.mock('../useBiometrics', () => ({
    useBiometrics: vi.fn(() => ({
        checkBiometricsEnabled: vi.fn().mockResolvedValue(false),
        disableBiometrics: vi.fn(),
        refreshBiometricsBinding: vi.fn(),
    })),
}))

const wireBlobMocks = () => {
    kmsMocks.commitSecret.mockImplementation(
        async ({ id, bytes }: { id: string; bytes: Uint8Array }) => {
            // Snapshot bytes via a defensive copy (mirroring production
            // commitSecret behavior). Callers now zero their input
            // buffer once commit resolves; without copying here the
            // mock's stashed reference would be wiped out from under
            // the test.
            const copy = new Uint8Array(bytes)
            if (id === PIN_RECORD_KEY_ID) kmsMocks.pinBytes = copy
            else if (id === DURESS_PIN_RECORD_KEY_ID)
                kmsMocks.duressPinBytes = copy
            else kmsMocks.biometricBytes = copy
        },
    )
    kmsMocks.withSecret.mockImplementation(
        async (id: string, handler: (bytes: Uint8Array) => unknown) => {
            const stash =
                id === PIN_RECORD_KEY_ID
                    ? kmsMocks.pinBytes
                    : id === DURESS_PIN_RECORD_KEY_ID
                      ? kmsMocks.duressPinBytes
                      : kmsMocks.biometricBytes
            if (!stash) return null
            // Mirror production `withSecret`: hand the handler a fresh
            // decrypted copy and zero THAT copy in finally. The stashed
            // bytes represent the persisted encrypted form — they must
            // survive across calls so the next `loadRecord` can read
            // them again. Zeroing `stash` directly here would wipe the
            // persisted state out from under subsequent calls (the bug
            // that broke 19 of these tests).
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
            : id === DURESS_PIN_RECORD_KEY_ID
              ? kmsMocks.duressPinBytes !== null
              : kmsMocks.biometricBytes !== null,
    )
    kmsMocks.removeSecret.mockImplementation(async (id: string) => {
        if (id === PIN_RECORD_KEY_ID) kmsMocks.pinBytes = null
        else if (id === DURESS_PIN_RECORD_KEY_ID) kmsMocks.duressPinBytes = null
        else kmsMocks.biometricBytes = null
    })
}

describe('usePinCode', () => {
    const mockIncrementFailedAttempts = vi.fn()
    const mockSetFailedAttempts = vi.fn()
    const mockResetFailedAttempts = vi.fn()
    const mockSetLockoutEndTime = vi.fn()
    const mockSetAutoLockStartedAt = vi.fn()

    beforeEach(() => {
        vi.clearAllMocks()
        kmsMocks.pinBytes = null
        kmsMocks.duressPinBytes = null
        kmsMocks.biometricBytes = null
        wireBlobMocks()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    const setupMock = (state: {
        failedAttempts: number
        lockoutEndTime: Nullable<number>
        autoLockStartedAt?: Nullable<number>
    }) => {
        vi.mocked(useSecurityStore).mockImplementation(
            (selector: (state: unknown) => unknown) => {
                const fullState = {
                    failedAttempts: state.failedAttempts,
                    lockoutEndTime: state.lockoutEndTime,
                    autoLockStartedAt: state.autoLockStartedAt ?? null,
                    incrementFailedAttempts: mockIncrementFailedAttempts,
                    setFailedAttempts: mockSetFailedAttempts,
                    resetFailedAttempts: mockResetFailedAttempts,
                    setLockoutEndTime: mockSetLockoutEndTime,
                    setAutoLockStartedAt: mockSetAutoLockStartedAt,
                    reset: vi.fn(),
                }
                return selector(fullState)
            },
        )
    }

    test('returns correct PIN enabled state', async () => {
        setupMock({ failedAttempts: 0, lockoutEndTime: null })
        kmsMocks.pinBytes = serializePinRecord(await createPinRecord('123456'))

        const { result } = renderHook(() => usePinCode())

        let isEnabled = false
        await act(async () => {
            isEnabled = await result.current.checkPinEnabled()
        })
        expect(isEnabled).toBe(true)
    }, 30_000)

    test('isLockedOut is true when lockout time is in future', () => {
        vi.useFakeTimers()
        const futureTime = Date.now() + 30000
        setupMock({ failedAttempts: 5, lockoutEndTime: futureTime })

        const { result } = renderHook(() => usePinCode())
        expect(result.current.isLockedOut).toBe(true)
    })

    test('isLockedOut is false when lockout time is in past', () => {
        vi.useFakeTimers()
        const pastTime = Date.now() - 1000
        setupMock({ failedAttempts: 5, lockoutEndTime: pastTime })

        const { result } = renderHook(() => usePinCode())
        expect(result.current.isLockedOut).toBe(false)
    })

    test('remainingLockoutSeconds calculates correctly', () => {
        vi.useFakeTimers()
        const futureTime = Date.now() + 45000
        setupMock({ failedAttempts: 5, lockoutEndTime: futureTime })

        const { result } = renderHook(() => usePinCode())
        expect(result.current.remainingLockoutSeconds).toBe(45)
    })

    test('remainingLockoutSeconds is 0 when not locked out', () => {
        setupMock({ failedAttempts: 0, lockoutEndTime: null })
        const { result } = renderHook(() => usePinCode())
        expect(result.current.remainingLockoutSeconds).toBe(0)
    })

    test('savePin stores a hashed PinRecord, not the raw PIN', async () => {
        setupMock({ failedAttempts: 0, lockoutEndTime: null })

        const { result } = renderHook(() => usePinCode())

        await act(async () => {
            await result.current.savePin('123456')
        })

        expect(kmsMocks.commitSecret).toHaveBeenCalledTimes(1)
        const arg = kmsMocks.commitSecret.mock.calls[0][0]
        expect(arg.id).toBe(PIN_RECORD_KEY_ID)
        // Read from the mock's snapshotted copy — `writeRecord` zeros
        // the source `bytes` Uint8Array once commit resolves, so
        // `arg.bytes` (the same reference) is now all zeros. The mock
        // mirrors production by deep-copying into `pinBytes` at call
        // time; that's the persisted form callers actually see.
        const persisted = kmsMocks.pinBytes!
        const record = parsePinRecord(persisted)
        expect(record).not.toBeNull()
        expect(record?.version).toBe(PIN_RECORD_VERSION)
        expect(record?.salt).toMatch(/^[0-9a-f]{32}$/)
        expect(record?.hash).toMatch(/^[0-9a-f]{64}$/)
        // The raw PIN must never appear in the serialized bytes.
        expect(new TextDecoder().decode(persisted)).not.toContain('123456')
        expect(mockSetFailedAttempts).toHaveBeenCalledWith(0)
        expect(mockSetLockoutEndTime).toHaveBeenCalledWith(null)
    }, 30_000)

    test('savePin re-binds biometric storage when biometrics are enabled', async () => {
        const refreshBiometricsBinding = vi.fn()
        const disableBiometrics = vi.fn()
        const { useBiometrics } = await import('../useBiometrics')
        vi.mocked(useBiometrics).mockReturnValue({
            checkBiometricsEnabled: vi.fn().mockResolvedValue(true),
            refreshBiometricsBinding,
            disableBiometrics,
            checkBiometricsAvailable: vi.fn(),
            enableBiometrics: vi.fn(),
            authenticateWithBiometrics: vi.fn(),
            isEnabled: true,
            isAvailable: true,
        })
        setupMock({ failedAttempts: 0, lockoutEndTime: null })

        const { result } = renderHook(() => usePinCode())

        await act(async () => {
            await result.current.savePin('123456')
        })

        expect(refreshBiometricsBinding).toHaveBeenCalled()
        // Critical: the raw PIN bytes must never be passed anywhere — the
        // bug we fixed was savePin writing `encoder.encode(pin)` into the
        // biometric blob, which puts cleartext PIN in the keystore.
        expect(refreshBiometricsBinding).not.toHaveBeenCalledWith(
            expect.any(Uint8Array),
        )
    }, 30_000)

    test('savePin(null) removes the PIN and disables biometrics when enabled', async () => {
        const refreshBiometricsBinding = vi.fn()
        const disableBiometrics = vi.fn()
        const { useBiometrics } = await import('../useBiometrics')
        vi.mocked(useBiometrics).mockReturnValue({
            checkBiometricsEnabled: vi.fn().mockResolvedValue(true),
            refreshBiometricsBinding,
            disableBiometrics,
            checkBiometricsAvailable: vi.fn(),
            enableBiometrics: vi.fn(),
            authenticateWithBiometrics: vi.fn(),
            isEnabled: true,
            isAvailable: true,
        })
        setupMock({ failedAttempts: 0, lockoutEndTime: null })
        kmsMocks.pinBytes = serializePinRecord(await createPinRecord('123456'))

        const { result } = renderHook(() => usePinCode())

        await act(async () => {
            await result.current.savePin(null)
        })

        expect(kmsMocks.removeSecret).toHaveBeenCalledWith(PIN_RECORD_KEY_ID)
        expect(disableBiometrics).toHaveBeenCalled()
    }, 30_000)

    // `checkBiometricsEnabled` false no longer implies the blob is gone: it also
    // reports false while keeping the blob for an unconfirmable enrollment (iOS
    // Face ID lockout). Gating the teardown on it would strand the blob holding
    // a copy of the PinRecord just deleted here — the only remaining copy.
    test('savePin(null) tears down biometrics even when the enrollment cannot be confirmed', async () => {
        const disableBiometrics = vi.fn()
        const { useBiometrics } = await import('../useBiometrics')
        vi.mocked(useBiometrics).mockReturnValue({
            checkBiometricsEnabled: vi.fn().mockResolvedValue(false),
            refreshBiometricsBinding: vi.fn(),
            disableBiometrics,
            checkBiometricsAvailable: vi.fn(),
            enableBiometrics: vi.fn(),
            authenticateWithBiometrics: vi.fn(),
            isEnabled: false,
            isAvailable: true,
        })
        setupMock({ failedAttempts: 0, lockoutEndTime: null })
        kmsMocks.pinBytes = serializePinRecord(await createPinRecord('123456'))

        const { result } = renderHook(() => usePinCode())

        await act(async () => {
            await result.current.savePin(null)
        })

        expect(disableBiometrics).toHaveBeenCalled()
    }, 30_000)

    test('verifyPin returns `ok` for correct PIN against a hashed record', async () => {
        setupMock({ failedAttempts: 0, lockoutEndTime: null })

        const record = await createPinRecord('123456')
        kmsMocks.pinBytes = serializePinRecord(record)

        const { result } = renderHook(() => usePinCode())

        let outcome: Awaited<
            ReturnType<typeof result.current.verifyPin>
        > | null = null
        await act(async () => {
            outcome = await result.current.verifyPin('123456')
        })
        expect(outcome).toEqual({ kind: 'ok' })
    }, 30_000)

    test('verifyPin returns `fail` for incorrect PIN against a hashed record', async () => {
        setupMock({ failedAttempts: 0, lockoutEndTime: null })

        const record = await createPinRecord('123456')
        kmsMocks.pinBytes = serializePinRecord(record)

        const { result } = renderHook(() => usePinCode())

        let outcome: Awaited<
            ReturnType<typeof result.current.verifyPin>
        > | null = null
        await act(async () => {
            outcome = await result.current.verifyPin('654321')
        })
        expect(outcome).toEqual({ kind: 'fail' })
    }, 30_000)

    test('verifyPin fails closed for the correct PIN when the record itself is locked', async () => {
        // Store flag deliberately NOT set (simulates the startup race) — the
        // lockout must be honored from the persisted record, not the store.
        setupMock({ failedAttempts: 0, lockoutEndTime: null })

        const base = await createPinRecord('123456')
        kmsMocks.pinBytes = serializePinRecord({
            ...base,
            failedAttempts: 5,
            lockoutEndTime: Date.now() + 60_000,
        })

        const { result } = renderHook(() => usePinCode())

        let outcome: Awaited<
            ReturnType<typeof result.current.verifyPin>
        > | null = null
        await act(async () => {
            outcome = await result.current.verifyPin('123456')
        })
        expect(outcome).toEqual({ kind: 'fail' })
    }, 30_000)

    test('verifyPin still returns `duress` when the record is locked (escape hatch preserved)', async () => {
        setupMock({ failedAttempts: 0, lockoutEndTime: null })

        const base = await createPinRecord('123456')
        kmsMocks.pinBytes = serializePinRecord({
            ...base,
            failedAttempts: 5,
            lockoutEndTime: Date.now() + 60_000,
        })
        kmsMocks.duressPinBytes = serializePinRecord(
            await createPinRecord('111111'),
        )

        const { result } = renderHook(() => usePinCode())

        let outcome: Awaited<
            ReturnType<typeof result.current.verifyPin>
        > | null = null
        await act(async () => {
            outcome = await result.current.verifyPin('111111')
        })
        expect(outcome).toEqual({ kind: 'duress' })
    }, 30_000)

    test('verifyPin returns `fail` when no PIN stored', async () => {
        setupMock({ failedAttempts: 0, lockoutEndTime: null })

        const { result } = renderHook(() => usePinCode())

        let outcome: Awaited<
            ReturnType<typeof result.current.verifyPin>
        > | null = null
        await act(async () => {
            outcome = await result.current.verifyPin('123456')
        })
        expect(outcome).toEqual({ kind: 'fail' })
    })

    test('hydrates lockout state from the stored record on mount', async () => {
        setupMock({ failedAttempts: 0, lockoutEndTime: null })

        const baseRecord = await createPinRecord('123456')
        const stored = {
            ...baseRecord,
            failedAttempts: 3,
            lockoutEndTime: 987654321,
        }
        kmsMocks.pinBytes = serializePinRecord(stored)

        renderHook(() => usePinCode())

        await waitFor(() => {
            expect(mockSetFailedAttempts).toHaveBeenCalledWith(3)
            expect(mockSetLockoutEndTime).toHaveBeenCalledWith(987654321)
        })
    }, 30_000)

    test('handleFailedAttempt increments and persists to the record', async () => {
        setupMock({ failedAttempts: 2, lockoutEndTime: null })

        const baseRecord = await createPinRecord('123456')
        kmsMocks.pinBytes = serializePinRecord({
            ...baseRecord,
            failedAttempts: 2,
            lockoutEndTime: null,
        })

        const { result } = renderHook(() => usePinCode())

        await act(async () => {
            await result.current.handleFailedAttempt()
        })

        expect(mockSetFailedAttempts).toHaveBeenCalledWith(3)
        const lastCall = kmsMocks.commitSecret.mock.calls.at(-1)
        expect(lastCall).toBeDefined()
        // `lastCall![0].bytes` is zeroed by writeRecord's finally; read
        // the snapshot the mock stashed at call time instead.
        const persisted = parsePinRecord(kmsMocks.pinBytes!)
        expect(persisted?.failedAttempts).toBe(3)
        expect(persisted?.lockoutEndTime).toBeNull()
    }, 30_000)

    test('handleFailedAttempt triggers lockout after max attempts', async () => {
        vi.useFakeTimers()
        const now = Date.now()
        vi.setSystemTime(now)

        setupMock({
            failedAttempts: MAX_PIN_ATTEMPTS_BEFORE_LOCKOUT - 1,
            lockoutEndTime: null,
        })

        const baseRecord = await createPinRecord('123456')
        kmsMocks.pinBytes = serializePinRecord({
            ...baseRecord,
            failedAttempts: MAX_PIN_ATTEMPTS_BEFORE_LOCKOUT - 1,
            lockoutEndTime: null,
        })

        const { result } = renderHook(() => usePinCode())

        await act(async () => {
            await result.current.handleFailedAttempt()
        })

        expect(mockSetLockoutEndTime).toHaveBeenCalledWith(
            now + INITIAL_LOCKOUT_SECONDS * 1000,
        )
        const lastCall = kmsMocks.commitSecret.mock.calls.at(-1)
        // `lastCall![0].bytes` is zeroed by writeRecord's finally; read
        // the snapshot the mock stashed at call time instead.
        const persisted = parsePinRecord(kmsMocks.pinBytes!)
        expect(persisted?.lockoutEndTime).toBe(
            now + INITIAL_LOCKOUT_SECONDS * 1000,
        )
    }, 30_000)

    test('handleFailedAttempt doubles lockout duration on second lockout', async () => {
        vi.useFakeTimers()
        const now = Date.now()
        vi.setSystemTime(now)

        setupMock({
            failedAttempts: MAX_PIN_ATTEMPTS_BEFORE_LOCKOUT * 2 - 1,
            lockoutEndTime: null,
        })

        const baseRecord = await createPinRecord('123456')
        kmsMocks.pinBytes = serializePinRecord({
            ...baseRecord,
            failedAttempts: MAX_PIN_ATTEMPTS_BEFORE_LOCKOUT * 2 - 1,
            lockoutEndTime: null,
        })

        const { result } = renderHook(() => usePinCode())

        await act(async () => {
            await result.current.handleFailedAttempt()
        })

        expect(mockSetLockoutEndTime).toHaveBeenCalledWith(
            now + INITIAL_LOCKOUT_SECONDS * 2 * 1000,
        )
    }, 30_000)

    test('getLockoutDuration returns 0 when no lockout', () => {
        setupMock({ failedAttempts: 3, lockoutEndTime: null })
        const { result } = renderHook(() => usePinCode())
        expect(result.current.getLockoutDuration()).toBe(0)
    })

    test('getLockoutDuration calculates exponential backoff correctly', () => {
        setupMock({
            failedAttempts: MAX_PIN_ATTEMPTS_BEFORE_LOCKOUT,
            lockoutEndTime: Date.now() + 30000,
        })
        const { result } = renderHook(() => usePinCode())
        expect(result.current.getLockoutDuration()).toBe(
            INITIAL_LOCKOUT_SECONDS,
        )
    })

    test('getLockoutDuration doubles for second lockout block', () => {
        setupMock({
            failedAttempts: MAX_PIN_ATTEMPTS_BEFORE_LOCKOUT * 2,
            lockoutEndTime: Date.now() + 60000,
        })
        const { result } = renderHook(() => usePinCode())
        expect(result.current.getLockoutDuration()).toBe(
            INITIAL_LOCKOUT_SECONDS * 2,
        )
    })

    test('resetFailedAttempts resets store and persists to record', async () => {
        setupMock({ failedAttempts: 5, lockoutEndTime: null })

        const baseRecord = await createPinRecord('123456')
        kmsMocks.pinBytes = serializePinRecord({
            ...baseRecord,
            failedAttempts: 5,
            lockoutEndTime: 1111,
        })

        const { result } = renderHook(() => usePinCode())

        await act(async () => {
            await result.current.resetFailedAttempts()
        })

        expect(mockResetFailedAttempts).toHaveBeenCalled()
        expect(mockSetLockoutEndTime).toHaveBeenCalledWith(null)
        const lastCall = kmsMocks.commitSecret.mock.calls.at(-1)
        // `lastCall![0].bytes` is zeroed by writeRecord's finally; read
        // the snapshot the mock stashed at call time instead.
        const persisted = parsePinRecord(kmsMocks.pinBytes!)
        expect(persisted?.failedAttempts).toBe(0)
        expect(persisted?.lockoutEndTime).toBeNull()
    }, 30_000)

    test('checkAutoLock returns false when PIN is not enabled', async () => {
        setupMock({ failedAttempts: 0, lockoutEndTime: null })

        const { result } = renderHook(() => usePinCode())

        let shouldLock = true
        await act(async () => {
            shouldLock = await result.current.checkAutoLock()
        })
        expect(shouldLock).toBe(false)
    })

    test('checkAutoLock returns false when autoLockStartedAt is null', async () => {
        setupMock({
            failedAttempts: 0,
            lockoutEndTime: null,
            autoLockStartedAt: null,
        })
        kmsMocks.pinBytes = serializePinRecord(await createPinRecord('123456'))

        const { result } = renderHook(() => usePinCode())

        let shouldLock = true
        await act(async () => {
            shouldLock = await result.current.checkAutoLock()
        })
        expect(shouldLock).toBe(false)
    }, 30_000)

    test('checkAutoLock returns true when timeout exceeded', async () => {
        vi.useFakeTimers()
        const now = Date.now()
        vi.setSystemTime(now)

        setupMock({
            failedAttempts: 0,
            lockoutEndTime: null,
            autoLockStartedAt: now - 6 * 60 * 1000,
        })
        kmsMocks.pinBytes = serializePinRecord(await createPinRecord('123456'))

        const { result } = renderHook(() => usePinCode())

        let shouldLock = false
        await act(async () => {
            shouldLock = await result.current.checkAutoLock()
        })
        expect(shouldLock).toBe(true)
    }, 30_000)

    test('checkAutoLock returns false when timeout not exceeded', async () => {
        vi.useFakeTimers()
        const now = Date.now()
        vi.setSystemTime(now)

        setupMock({
            failedAttempts: 0,
            lockoutEndTime: null,
            autoLockStartedAt: now - 2 * 60 * 1000,
        })
        kmsMocks.pinBytes = serializePinRecord(await createPinRecord('123456'))

        const { result } = renderHook(() => usePinCode())

        let shouldLock = true
        await act(async () => {
            shouldLock = await result.current.checkAutoLock()
        })
        expect(shouldLock).toBe(false)
    }, 30_000)

    test('checkAutoLock fails closed (locks) when autoLockStartedAt is NaN', async () => {
        setupMock({
            failedAttempts: 0,
            lockoutEndTime: null,
            autoLockStartedAt: NaN,
        })
        kmsMocks.pinBytes = serializePinRecord(await createPinRecord('123456'))

        const { result } = renderHook(() => usePinCode())

        let shouldLock = false
        await act(async () => {
            shouldLock = await result.current.checkAutoLock()
        })
        expect(shouldLock).toBe(true)
    }, 30_000)

    test('checkAutoLock fails closed (locks) when autoLockStartedAt is in the future', async () => {
        vi.useFakeTimers()
        const now = Date.now()
        vi.setSystemTime(now)

        setupMock({
            failedAttempts: 0,
            lockoutEndTime: null,
            autoLockStartedAt: now + 60 * 60 * 1000,
        })
        kmsMocks.pinBytes = serializePinRecord(await createPinRecord('123456'))

        const { result } = renderHook(() => usePinCode())

        let shouldLock = false
        await act(async () => {
            shouldLock = await result.current.checkAutoLock()
        })
        expect(shouldLock).toBe(true)
    }, 30_000)
})

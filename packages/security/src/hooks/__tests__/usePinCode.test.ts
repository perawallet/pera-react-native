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

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { usePinCode } from '../usePinCode'
import { useSecurityStore } from '../../store'
import {
    PIN_STORAGE_KEY,
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

const mockGetItem = vi.fn()
const mockSetItem = vi.fn()
const mockRemoveItem = vi.fn()

vi.mock('../../store', () => ({
    useSecurityStore: vi.fn(),
}))

vi.mock('@perawallet/wallet-extension-provider', () => ({
    getProvider: () => ({
        secureStorage: {
            getItem: mockGetItem,
            setItem: mockSetItem,
            removeItem: mockRemoveItem,
        },
    }),
}))

vi.mock('../useBiometrics', () => ({
    useBiometrics: vi.fn(() => ({
        checkBiometricsEnabled: vi.fn().mockResolvedValue(false),
        disableBiometrics: vi.fn(),
        setBiometricsCode: vi.fn(),
    })),
}))

describe('usePinCode', () => {
    const mockIncrementFailedAttempts = vi.fn()
    const mockSetFailedAttempts = vi.fn()
    const mockResetFailedAttempts = vi.fn()
    const mockSetLockoutEndTime = vi.fn()
    const mockSetAutoLockStartedAt = vi.fn()

    beforeEach(() => {
        vi.clearAllMocks()
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

        const pinData = new TextEncoder().encode('123456')
        mockGetItem.mockResolvedValue(pinData)

        const { result } = renderHook(() => usePinCode())

        let isEnabled = false
        await act(async () => {
            isEnabled = await result.current.checkPinEnabled()
        })
        expect(isEnabled).toBe(true)
    })

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
        mockGetItem.mockResolvedValue(null)

        const { result } = renderHook(() => usePinCode())

        await act(async () => {
            await result.current.savePin('123456')
        })

        expect(mockSetItem).toHaveBeenCalledTimes(1)
        const [key, payload] = mockSetItem.mock.calls[0] as [string, Uint8Array]
        expect(key).toBe(PIN_STORAGE_KEY)
        const record = parsePinRecord(payload)
        expect(record).not.toBeNull()
        expect(record?.version).toBe(PIN_RECORD_VERSION)
        expect(record?.salt).toMatch(/^[0-9a-f]{32}$/)
        expect(record?.hash).toMatch(/^[0-9a-f]{64}$/)
        // The raw PIN must never appear in the serialized bytes.
        expect(new TextDecoder().decode(payload)).not.toContain('123456')
        expect(mockSetFailedAttempts).toHaveBeenCalledWith(0)
        expect(mockSetLockoutEndTime).toHaveBeenCalledWith(null)
    }, 30_000)

    test('savePin also updates biometric storage when biometrics are enabled', async () => {
        const setBiometricsCode = vi.fn()
        const disableBiometrics = vi.fn()
        const { useBiometrics } = await import('../useBiometrics')
        vi.mocked(useBiometrics).mockReturnValue({
            checkBiometricsEnabled: vi.fn().mockResolvedValue(true),
            setBiometricsCode,
            disableBiometrics,
            checkBiometricsAvailable: vi.fn(),
            enableBiometrics: vi.fn(),
            authenticateWithBiometrics: vi.fn(),
            isEnabled: true,
            isAvailable: true,
        })
        setupMock({ failedAttempts: 0, lockoutEndTime: null })
        mockGetItem.mockResolvedValue(null)

        const { result } = renderHook(() => usePinCode())

        await act(async () => {
            await result.current.savePin('123456')
        })

        expect(setBiometricsCode).toHaveBeenCalled()
    }, 30_000)

    test('savePin(null) removes the PIN and disables biometrics when enabled', async () => {
        const setBiometricsCode = vi.fn()
        const disableBiometrics = vi.fn()
        const { useBiometrics } = await import('../useBiometrics')
        vi.mocked(useBiometrics).mockReturnValue({
            checkBiometricsEnabled: vi.fn().mockResolvedValue(true),
            setBiometricsCode,
            disableBiometrics,
            checkBiometricsAvailable: vi.fn(),
            enableBiometrics: vi.fn(),
            authenticateWithBiometrics: vi.fn(),
            isEnabled: true,
            isAvailable: true,
        })
        setupMock({ failedAttempts: 0, lockoutEndTime: null })
        mockGetItem.mockResolvedValue(null)

        const { result } = renderHook(() => usePinCode())

        await act(async () => {
            await result.current.savePin(null)
        })

        expect(mockRemoveItem).toHaveBeenCalledWith(PIN_STORAGE_KEY)
        expect(disableBiometrics).toHaveBeenCalled()
    })

    test('verifyPin returns true for correct PIN against a hashed record', async () => {
        setupMock({ failedAttempts: 0, lockoutEndTime: null })

        const record = await createPinRecord('123456')
        mockGetItem.mockResolvedValue(serializePinRecord(record))

        const { result } = renderHook(() => usePinCode())

        let isValid = false
        await act(async () => {
            isValid = await result.current.verifyPin('123456')
        })
        expect(isValid).toBe(true)
    }, 30_000)

    test('verifyPin returns false for incorrect PIN against a hashed record', async () => {
        setupMock({ failedAttempts: 0, lockoutEndTime: null })

        const record = await createPinRecord('123456')
        mockGetItem.mockResolvedValue(serializePinRecord(record))

        const { result } = renderHook(() => usePinCode())

        let isValid = true
        await act(async () => {
            isValid = await result.current.verifyPin('654321')
        })
        expect(isValid).toBe(false)
    }, 30_000)

    test('verifyPin returns false when no PIN stored', async () => {
        setupMock({ failedAttempts: 0, lockoutEndTime: null })
        mockGetItem.mockResolvedValue(null)

        const { result } = renderHook(() => usePinCode())

        let isValid = true
        await act(async () => {
            isValid = await result.current.verifyPin('123456')
        })
        expect(isValid).toBe(false)
    })

    test('verifyPin migrates legacy plaintext PIN to a hashed record on success', async () => {
        setupMock({ failedAttempts: 0, lockoutEndTime: null })
        mockGetItem.mockResolvedValue(new TextEncoder().encode('123456'))

        const { result } = renderHook(() => usePinCode())

        let isValid = false
        await act(async () => {
            isValid = await result.current.verifyPin('123456')
        })

        expect(isValid).toBe(true)
        expect(mockSetItem).toHaveBeenCalledTimes(1)
        const [key, payload] = mockSetItem.mock.calls[0] as [string, Uint8Array]
        expect(key).toBe(PIN_STORAGE_KEY)
        const record = parsePinRecord(payload)
        expect(record?.version).toBe(PIN_RECORD_VERSION)
    }, 30_000)

    test('verifyPin against legacy plaintext PIN returns false for wrong PIN and does not migrate', async () => {
        setupMock({ failedAttempts: 0, lockoutEndTime: null })
        mockGetItem.mockResolvedValue(new TextEncoder().encode('123456'))

        const { result } = renderHook(() => usePinCode())

        let isValid = true
        await act(async () => {
            isValid = await result.current.verifyPin('654321')
        })

        expect(isValid).toBe(false)
        expect(mockSetItem).not.toHaveBeenCalled()
    })

    test('hydrates lockout state from the stored record on mount', async () => {
        setupMock({ failedAttempts: 0, lockoutEndTime: null })

        const baseRecord = await createPinRecord('123456')
        const stored = {
            ...baseRecord,
            failedAttempts: 3,
            lockoutEndTime: 987654321,
        }
        mockGetItem.mockResolvedValue(serializePinRecord(stored))

        renderHook(() => usePinCode())

        await waitFor(() => {
            expect(mockSetFailedAttempts).toHaveBeenCalledWith(3)
            expect(mockSetLockoutEndTime).toHaveBeenCalledWith(987654321)
        })
    }, 30_000)

    test('handleFailedAttempt increments and persists to the record', async () => {
        setupMock({ failedAttempts: 2, lockoutEndTime: null })

        const baseRecord = await createPinRecord('123456')
        mockGetItem.mockResolvedValue(
            serializePinRecord({
                ...baseRecord,
                failedAttempts: 2,
                lockoutEndTime: null,
            }),
        )

        const { result } = renderHook(() => usePinCode())

        await act(async () => {
            await result.current.handleFailedAttempt()
        })

        expect(mockSetFailedAttempts).toHaveBeenCalledWith(3)
        const lastCall = mockSetItem.mock.calls.at(-1) as
            | [string, Uint8Array]
            | undefined
        expect(lastCall).toBeDefined()
        const persisted = parsePinRecord(lastCall![1])
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
        mockGetItem.mockResolvedValue(
            serializePinRecord({
                ...baseRecord,
                failedAttempts: MAX_PIN_ATTEMPTS_BEFORE_LOCKOUT - 1,
                lockoutEndTime: null,
            }),
        )

        const { result } = renderHook(() => usePinCode())

        await act(async () => {
            await result.current.handleFailedAttempt()
        })

        expect(mockSetLockoutEndTime).toHaveBeenCalledWith(
            now + INITIAL_LOCKOUT_SECONDS * 1000,
        )
        const lastCall = mockSetItem.mock.calls.at(-1) as
            | [string, Uint8Array]
            | undefined
        const persisted = parsePinRecord(lastCall![1])
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
        mockGetItem.mockResolvedValue(
            serializePinRecord({
                ...baseRecord,
                failedAttempts: MAX_PIN_ATTEMPTS_BEFORE_LOCKOUT * 2 - 1,
                lockoutEndTime: null,
            }),
        )

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
        mockGetItem.mockResolvedValue(
            serializePinRecord({
                ...baseRecord,
                failedAttempts: 5,
                lockoutEndTime: 1111,
            }),
        )

        const { result } = renderHook(() => usePinCode())

        await act(async () => {
            await result.current.resetFailedAttempts()
        })

        expect(mockResetFailedAttempts).toHaveBeenCalled()
        expect(mockSetLockoutEndTime).toHaveBeenCalledWith(null)
        const lastCall = mockSetItem.mock.calls.at(-1) as
            | [string, Uint8Array]
            | undefined
        const persisted = parsePinRecord(lastCall![1])
        expect(persisted?.failedAttempts).toBe(0)
        expect(persisted?.lockoutEndTime).toBeNull()
    }, 30_000)

    test('checkAutoLock returns false when PIN is not enabled', async () => {
        setupMock({ failedAttempts: 0, lockoutEndTime: null })
        mockGetItem.mockResolvedValue(null)

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
        mockGetItem.mockResolvedValue(new TextEncoder().encode('123456'))

        const { result } = renderHook(() => usePinCode())

        let shouldLock = true
        await act(async () => {
            shouldLock = await result.current.checkAutoLock()
        })
        expect(shouldLock).toBe(false)
    })

    test('checkAutoLock returns true when timeout exceeded', async () => {
        vi.useFakeTimers()
        const now = Date.now()
        vi.setSystemTime(now)

        setupMock({
            failedAttempts: 0,
            lockoutEndTime: null,
            autoLockStartedAt: now - 6 * 60 * 1000,
        })
        mockGetItem.mockResolvedValue(new TextEncoder().encode('123456'))

        const { result } = renderHook(() => usePinCode())

        let shouldLock = false
        await act(async () => {
            shouldLock = await result.current.checkAutoLock()
        })
        expect(shouldLock).toBe(true)
    })

    test('checkAutoLock returns false when timeout not exceeded', async () => {
        vi.useFakeTimers()
        const now = Date.now()
        vi.setSystemTime(now)

        setupMock({
            failedAttempts: 0,
            lockoutEndTime: null,
            autoLockStartedAt: now - 2 * 60 * 1000,
        })
        mockGetItem.mockResolvedValue(new TextEncoder().encode('123456'))

        const { result } = renderHook(() => usePinCode())

        let shouldLock = true
        await act(async () => {
            shouldLock = await result.current.checkAutoLock()
        })
        expect(shouldLock).toBe(false)
    })
})

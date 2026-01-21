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
import { renderHook, act } from '@testing-library/react'
import { usePinCode } from '../usePinCode'
import { useSecurityStore } from '../../store'
import { useSecureStorageService } from '@perawallet/wallet-core-platform-integration'
import {
    PIN_STORAGE_KEY,
    MAX_PIN_ATTEMPTS_BEFORE_LOCKOUT,
    INITIAL_LOCKOUT_SECONDS,
} from '../../constants'

vi.mock('../../store', () => ({
    useSecurityStore: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-platform-integration', () => ({
    useSecureStorageService: vi.fn(),
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
    const mockResetFailedAttempts = vi.fn()
    const mockSetLockoutEndTime = vi.fn()
    const mockSetAutoLockStartedAt = vi.fn()
    const mockGetItem = vi.fn()
    const mockSetItem = vi.fn()
    const mockRemoveItem = vi.fn()

    beforeEach(() => {
        vi.clearAllMocks()
        vi.useFakeTimers()

        vi.mocked(useSecureStorageService).mockReturnValue({
            getItem: mockGetItem,
            setItem: mockSetItem,
            removeItem: mockRemoveItem,
        } as unknown as ReturnType<typeof useSecureStorageService>)
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    const setupMock = (state: {
        failedAttempts: number
        lockoutEndTime: number | null
        autoLockStartedAt?: number | null
    }) => {
        vi.mocked(useSecurityStore).mockImplementation(
            (selector: (state: unknown) => unknown) => {
                const fullState = {
                    failedAttempts: state.failedAttempts,
                    lockoutEndTime: state.lockoutEndTime,
                    autoLockStartedAt: state.autoLockStartedAt ?? null,
                    incrementFailedAttempts: mockIncrementFailedAttempts,
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
        setupMock({
            failedAttempts: 0,
            lockoutEndTime: null,
        })

        const pinData = new TextEncoder().encode('123456')
        mockGetItem.mockResolvedValue(pinData)

        const { result } = renderHook(() => usePinCode())

        let isEnabled: boolean = false
        await act(async () => {
            isEnabled = await result.current.checkPinEnabled()
        })

        expect(isEnabled).toBe(true)
    })

    test('isLockedOut is true when lockout time is in future', () => {
        const futureTime = Date.now() + 30000

        setupMock({
            failedAttempts: 5,
            lockoutEndTime: futureTime,
        })

        const { result } = renderHook(() => usePinCode())

        expect(result.current.isLockedOut).toBe(true)
    })

    test('isLockedOut is false when lockout time is in past', () => {
        const pastTime = Date.now() - 1000

        setupMock({
            failedAttempts: 5,
            lockoutEndTime: pastTime,
        })

        const { result } = renderHook(() => usePinCode())

        expect(result.current.isLockedOut).toBe(false)
    })

    test('remainingLockoutSeconds calculates correctly', () => {
        const futureTime = Date.now() + 45000 // 45 seconds

        setupMock({
            failedAttempts: 5,
            lockoutEndTime: futureTime,
        })

        const { result } = renderHook(() => usePinCode())

        expect(result.current.remainingLockoutSeconds).toBe(45)
    })

    test('remainingLockoutSeconds is 0 when not locked out', () => {
        setupMock({
            failedAttempts: 0,
            lockoutEndTime: null,
        })

        const { result } = renderHook(() => usePinCode())

        expect(result.current.remainingLockoutSeconds).toBe(0)
    })

    test('savePin stores PIN and enables PIN', async () => {
        setupMock({
            failedAttempts: 0,
            lockoutEndTime: null,
        })

        const { result } = renderHook(() => usePinCode())

        await act(async () => {
            await result.current.savePin('123456')
        })

        expect(mockSetItem).toHaveBeenCalledWith(
            PIN_STORAGE_KEY,
            new TextEncoder().encode('123456'),
        )
        expect(mockResetFailedAttempts).toHaveBeenCalled()
        expect(mockSetLockoutEndTime).toHaveBeenCalledWith(null)
    })

    test('verifyPin returns true for correct PIN', async () => {
        setupMock({
            failedAttempts: 0,
            lockoutEndTime: null,
        })

        const storedPin = new TextEncoder().encode('123456')
        mockGetItem.mockResolvedValue(storedPin)

        const { result } = renderHook(() => usePinCode())

        let isValid: boolean = false
        await act(async () => {
            isValid = await result.current.verifyPin('123456')
        })

        expect(isValid).toBe(true)
        expect(mockGetItem).toHaveBeenCalledWith(PIN_STORAGE_KEY)
    })

    test('verifyPin returns false for incorrect PIN', async () => {
        setupMock({
            failedAttempts: 0,
            lockoutEndTime: null,
        })

        const storedPin = new TextEncoder().encode('123456')
        mockGetItem.mockResolvedValue(storedPin)

        const { result } = renderHook(() => usePinCode())

        let isValid: boolean = true
        await act(async () => {
            isValid = await result.current.verifyPin('654321')
        })

        expect(isValid).toBe(false)
    })

    test('verifyPin returns false when no PIN stored', async () => {
        setupMock({
            failedAttempts: 0,
            lockoutEndTime: null,
        })

        mockGetItem.mockResolvedValue(null)

        const { result } = renderHook(() => usePinCode())

        let isValid: boolean = true
        await act(async () => {
            isValid = await result.current.verifyPin('123456')
        })

        expect(isValid).toBe(false)
    })

    test('handleFailedAttempt increments attempts', () => {
        setupMock({
            failedAttempts: 2,
            lockoutEndTime: null,
        })

        const { result } = renderHook(() => usePinCode())

        act(() => {
            result.current.handleFailedAttempt()
        })

        expect(mockIncrementFailedAttempts).toHaveBeenCalled()
    })

    test('handleFailedAttempt triggers lockout after max attempts', () => {
        const now = Date.now()
        vi.setSystemTime(now)

        setupMock({
            failedAttempts: MAX_PIN_ATTEMPTS_BEFORE_LOCKOUT - 1,
            lockoutEndTime: null,
        })

        const { result } = renderHook(() => usePinCode())

        act(() => {
            result.current.handleFailedAttempt()
        })

        expect(mockIncrementFailedAttempts).toHaveBeenCalled()
        expect(mockSetLockoutEndTime).toHaveBeenCalledWith(
            now + INITIAL_LOCKOUT_SECONDS * 1000,
        )
    })

    test('handleFailedAttempt doubles lockout duration on second lockout', () => {
        const now = Date.now()
        vi.setSystemTime(now)

        setupMock({
            failedAttempts: MAX_PIN_ATTEMPTS_BEFORE_LOCKOUT * 2 - 1,
            lockoutEndTime: null,
        })

        const { result } = renderHook(() => usePinCode())

        act(() => {
            result.current.handleFailedAttempt()
        })

        expect(mockSetLockoutEndTime).toHaveBeenCalledWith(
            now + INITIAL_LOCKOUT_SECONDS * 2 * 1000,
        )
    })

    test('getLockoutDuration returns 0 when no lockout', () => {
        setupMock({
            failedAttempts: 3,
            lockoutEndTime: null,
        })

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

    test('resetFailedAttempts calls store action', () => {
        setupMock({
            failedAttempts: 5,
            lockoutEndTime: null,
        })

        const { result } = renderHook(() => usePinCode())

        act(() => {
            result.current.resetFailedAttempts()
        })

        expect(mockResetFailedAttempts).toHaveBeenCalled()
        expect(mockSetLockoutEndTime).toHaveBeenCalledWith(null)
    })

    test('checkAutoLock returns false when PIN is not enabled', async () => {
        setupMock({
            failedAttempts: 0,
            lockoutEndTime: null,
        })

        mockGetItem.mockResolvedValue(null)

        const { result } = renderHook(() => usePinCode())

        let shouldLock: boolean = true
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

        const pinData = new TextEncoder().encode('123456')
        mockGetItem.mockResolvedValue(pinData)

        const { result } = renderHook(() => usePinCode())

        let shouldLock: boolean = true
        await act(async () => {
            shouldLock = await result.current.checkAutoLock()
        })

        expect(shouldLock).toBe(false)
    })

    test('checkAutoLock returns true when timeout exceeded', async () => {
        const now = Date.now()
        vi.setSystemTime(now)

        setupMock({
            failedAttempts: 0,
            lockoutEndTime: null,
            autoLockStartedAt: now - 6 * 60 * 1000, // 6 minutes ago (timeout is 5 min)
        })

        const pinData = new TextEncoder().encode('123456')
        mockGetItem.mockResolvedValue(pinData)

        const { result } = renderHook(() => usePinCode())

        let shouldLock: boolean = false
        await act(async () => {
            shouldLock = await result.current.checkAutoLock()
        })

        expect(shouldLock).toBe(true)
    })

    test('checkAutoLock returns false when timeout not exceeded', async () => {
        const now = Date.now()
        vi.setSystemTime(now)

        setupMock({
            failedAttempts: 0,
            lockoutEndTime: null,
            autoLockStartedAt: now - 2 * 60 * 1000, // 2 minutes ago (timeout is 5 min)
        })

        const pinData = new TextEncoder().encode('123456')
        mockGetItem.mockResolvedValue(pinData)

        const { result } = renderHook(() => usePinCode())

        let shouldLock: boolean = true
        await act(async () => {
            shouldLock = await result.current.checkAutoLock()
        })

        expect(shouldLock).toBe(false)
    })
})

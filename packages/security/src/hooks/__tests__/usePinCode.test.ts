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

import { describe, test, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { usePinCode } from '../usePinCode'
import { useSecurityStore } from '../../store'
import { useSecureStorageService } from '@perawallet/wallet-core-platform-integration'
import {
    PIN_STORAGE_KEY,
    MAX_PIN_ATTEMPTS_BEFORE_LOCKOUT,
    INITIAL_LOCKOUT_SECONDS,
} from '../../models'

vi.mock('../../store', () => ({
    useSecurityStore: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-platform-integration', () => ({
    useSecureStorageService: vi.fn(),
}))

describe('usePinCode', () => {
    const mockSetIsPinEnabled = vi.fn()
    const mockSetIsBiometricEnabled = vi.fn()
    const mockIncrementFailedAttempts = vi.fn()
    const mockResetFailedAttempts = vi.fn()
    const mockSetLockoutEndTime = vi.fn()
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
        isPinEnabled: boolean
        failedAttempts: number
        lockoutEndTime: number | null
    }) => {
        vi.mocked(useSecurityStore).mockImplementation(
            (selector: (state: unknown) => unknown) => {
                const fullState = {
                    ...state,
                    isBiometricEnabled: false,
                    lastBackgroundTime: null,
                    setIsPinEnabled: mockSetIsPinEnabled,
                    setIsBiometricEnabled: mockSetIsBiometricEnabled,
                    incrementFailedAttempts: mockIncrementFailedAttempts,
                    resetFailedAttempts: mockResetFailedAttempts,
                    setLockoutEndTime: mockSetLockoutEndTime,
                    setLastBackgroundTime: vi.fn(),
                    reset: vi.fn(),
                }
                return selector(fullState)
            },
        )
    }

    test('returns correct PIN enabled state', () => {
        setupMock({
            isPinEnabled: true,
            failedAttempts: 0,
            lockoutEndTime: null,
        })

        const { result } = renderHook(() => usePinCode())

        expect(result.current.isPinEnabled).toBe(true)
    })

    test('isLockedOut is true when lockout time is in future', () => {
        const futureTime = Date.now() + 30000

        setupMock({
            isPinEnabled: true,
            failedAttempts: 5,
            lockoutEndTime: futureTime,
        })

        const { result } = renderHook(() => usePinCode())

        expect(result.current.isLockedOut).toBe(true)
    })

    test('isLockedOut is false when lockout time is in past', () => {
        const pastTime = Date.now() - 1000

        setupMock({
            isPinEnabled: true,
            failedAttempts: 5,
            lockoutEndTime: pastTime,
        })

        const { result } = renderHook(() => usePinCode())

        expect(result.current.isLockedOut).toBe(false)
    })

    test('remainingLockoutSeconds calculates correctly', () => {
        const futureTime = Date.now() + 45000 // 45 seconds

        setupMock({
            isPinEnabled: true,
            failedAttempts: 5,
            lockoutEndTime: futureTime,
        })

        const { result } = renderHook(() => usePinCode())

        expect(result.current.remainingLockoutSeconds).toBe(45)
    })

    test('remainingLockoutSeconds is 0 when not locked out', () => {
        setupMock({
            isPinEnabled: true,
            failedAttempts: 0,
            lockoutEndTime: null,
        })

        const { result } = renderHook(() => usePinCode())

        expect(result.current.remainingLockoutSeconds).toBe(0)
    })

    test('savePin stores PIN and enables PIN', async () => {
        setupMock({
            isPinEnabled: false,
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
        expect(mockSetIsPinEnabled).toHaveBeenCalledWith(true)
        expect(mockResetFailedAttempts).toHaveBeenCalled()
        expect(mockSetLockoutEndTime).toHaveBeenCalledWith(null)
    })

    test('verifyPin returns true for correct PIN', async () => {
        setupMock({
            isPinEnabled: true,
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
            isPinEnabled: true,
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
            isPinEnabled: true,
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

    test('deletePin removes PIN and disables security', async () => {
        setupMock({
            isPinEnabled: true,
            failedAttempts: 3,
            lockoutEndTime: Date.now() + 30000,
        })

        const { result } = renderHook(() => usePinCode())

        await act(async () => {
            await result.current.deletePin()
        })

        expect(mockRemoveItem).toHaveBeenCalledWith(PIN_STORAGE_KEY)
        expect(mockSetIsPinEnabled).toHaveBeenCalledWith(false)
        expect(mockSetIsBiometricEnabled).toHaveBeenCalledWith(false)
        expect(mockResetFailedAttempts).toHaveBeenCalled()
        expect(mockSetLockoutEndTime).toHaveBeenCalledWith(null)
    })

    test('changePin returns false for incorrect old PIN', async () => {
        setupMock({
            isPinEnabled: true,
            failedAttempts: 0,
            lockoutEndTime: null,
        })

        const storedPin = new TextEncoder().encode('123456')
        mockGetItem.mockResolvedValue(storedPin)

        const { result } = renderHook(() => usePinCode())

        let success: boolean = true
        await act(async () => {
            success = await result.current.changePin('wrong', '654321')
        })

        expect(success).toBe(false)
        expect(mockSetItem).not.toHaveBeenCalled()
    })

    test('changePin successfully changes PIN with correct old PIN', async () => {
        setupMock({
            isPinEnabled: true,
            failedAttempts: 0,
            lockoutEndTime: null,
        })

        const storedPin = new TextEncoder().encode('123456')
        mockGetItem.mockResolvedValue(storedPin)

        const { result } = renderHook(() => usePinCode())

        let success: boolean = false
        await act(async () => {
            success = await result.current.changePin('123456', '654321')
        })

        expect(success).toBe(true)
        expect(mockSetItem).toHaveBeenCalledWith(
            PIN_STORAGE_KEY,
            new TextEncoder().encode('654321'),
        )
    })

    test('handleFailedAttempt increments attempts', () => {
        setupMock({
            isPinEnabled: true,
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
            isPinEnabled: true,
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
            isPinEnabled: true,
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
            isPinEnabled: true,
            failedAttempts: 3,
            lockoutEndTime: null,
        })

        const { result } = renderHook(() => usePinCode())

        expect(result.current.getLockoutDuration()).toBe(0)
    })

    test('getLockoutDuration calculates exponential backoff correctly', () => {
        setupMock({
            isPinEnabled: true,
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
            isPinEnabled: true,
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
            isPinEnabled: true,
            failedAttempts: 5,
            lockoutEndTime: null,
        })

        const { result } = renderHook(() => usePinCode())

        act(() => {
            result.current.resetFailedAttempts()
        })

        expect(mockResetFailedAttempts).toHaveBeenCalled()
    })
})

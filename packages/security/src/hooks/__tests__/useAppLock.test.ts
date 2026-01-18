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
import { useAppLock } from '../useAppLock'
import { useSecurityStore } from '../../store'

vi.mock('../../store', () => ({
    useSecurityStore: vi.fn(),
}))

describe('useAppLock', () => {
    const mockSetLastBackgroundTime = vi.fn()
    const SESSION_TIMEOUT_MS = 5 * 60 * 1000 // 5 minutes

    beforeEach(() => {
        vi.clearAllMocks()
        vi.useFakeTimers()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    const setupMock = (state: {
        isPinEnabled: boolean
        isBiometricEnabled: boolean
        lastBackgroundTime: number | null
    }) => {
        vi.mocked(useSecurityStore).mockImplementation(
            (selector: (state: unknown) => unknown) => {
                const fullState = {
                    ...state,
                    failedAttempts: 0,
                    lockoutEndTime: null,
                    setIsPinEnabled: vi.fn(),
                    setIsBiometricEnabled: vi.fn(),
                    incrementFailedAttempts: vi.fn(),
                    resetFailedAttempts: vi.fn(),
                    setLockoutEndTime: vi.fn(),
                    setLastBackgroundTime: mockSetLastBackgroundTime,
                    reset: vi.fn(),
                }
                return selector(fullState)
            },
        )
    }

    test('returns correct state when PIN is enabled', () => {
        setupMock({
            isPinEnabled: true,
            isBiometricEnabled: false,
            lastBackgroundTime: Date.now(),
        })

        const { result } = renderHook(() => useAppLock())

        expect(result.current.isPinEnabled).toBe(true)
        expect(result.current.isBiometricEnabled).toBe(false)
    })

    test('shouldRequireAuth is false when PIN is disabled', () => {
        setupMock({
            isPinEnabled: false,
            isBiometricEnabled: false,
            lastBackgroundTime: null,
        })

        const { result } = renderHook(() => useAppLock())

        expect(result.current.shouldRequireAuth).toBe(false)
    })

    test('shouldRequireAuth is true when PIN enabled and no background time', () => {
        setupMock({
            isPinEnabled: true,
            isBiometricEnabled: false,
            lastBackgroundTime: null,
        })

        const { result } = renderHook(() => useAppLock())

        expect(result.current.shouldRequireAuth).toBe(true)
    })

    test('shouldRequireAuth is false when session has not expired', () => {
        const recentTime = Date.now() - 60000 // 1 minute ago

        setupMock({
            isPinEnabled: true,
            isBiometricEnabled: false,
            lastBackgroundTime: recentTime,
        })

        const { result } = renderHook(() => useAppLock())

        expect(result.current.shouldRequireAuth).toBe(false)
    })

    test('shouldRequireAuth is true when session has expired', () => {
        const oldTime = Date.now() - SESSION_TIMEOUT_MS - 1000 // 5 min + 1 sec ago

        setupMock({
            isPinEnabled: true,
            isBiometricEnabled: false,
            lastBackgroundTime: oldTime,
        })

        const { result } = renderHook(() => useAppLock())

        expect(result.current.shouldRequireAuth).toBe(true)
    })

    test('recordBackground sets current timestamp', () => {
        const now = Date.now()
        vi.setSystemTime(now)

        setupMock({
            isPinEnabled: true,
            isBiometricEnabled: false,
            lastBackgroundTime: null,
        })

        const { result } = renderHook(() => useAppLock())

        act(() => {
            result.current.recordBackground()
        })

        expect(mockSetLastBackgroundTime).toHaveBeenCalledWith(now)
    })

    test('recordForeground returns true when session expired', () => {
        const oldTime = Date.now() - SESSION_TIMEOUT_MS - 1000

        setupMock({
            isPinEnabled: true,
            isBiometricEnabled: false,
            lastBackgroundTime: oldTime,
        })

        const { result } = renderHook(() => useAppLock())

        let expired: boolean = false
        act(() => {
            expired = result.current.recordForeground()
        })

        expect(expired).toBe(true)
    })

    test('recordForeground returns false when session not expired', () => {
        const recentTime = Date.now() - 60000 // 1 minute ago

        setupMock({
            isPinEnabled: true,
            isBiometricEnabled: false,
            lastBackgroundTime: recentTime,
        })

        const { result } = renderHook(() => useAppLock())

        let expired: boolean = true
        act(() => {
            expired = result.current.recordForeground()
        })

        expect(expired).toBe(false)
    })

    test('checkSessionExpired returns false when PIN disabled', () => {
        setupMock({
            isPinEnabled: false,
            isBiometricEnabled: false,
            lastBackgroundTime: null,
        })

        const { result } = renderHook(() => useAppLock())

        expect(result.current.checkSessionExpired()).toBe(false)
    })

    test('checkSessionExpired returns true when lastBackgroundTime is null', () => {
        setupMock({
            isPinEnabled: true,
            isBiometricEnabled: false,
            lastBackgroundTime: null,
        })

        const { result } = renderHook(() => useAppLock())

        expect(result.current.checkSessionExpired()).toBe(true)
    })

    test('checkSessionExpired returns true when elapsed time exceeds timeout', () => {
        const oldTime = Date.now() - SESSION_TIMEOUT_MS - 1000

        setupMock({
            isPinEnabled: true,
            isBiometricEnabled: false,
            lastBackgroundTime: oldTime,
        })

        const { result } = renderHook(() => useAppLock())

        expect(result.current.checkSessionExpired()).toBe(true)
    })

    test('checkSessionExpired returns false when elapsed time within timeout', () => {
        const recentTime = Date.now() - 60000

        setupMock({
            isPinEnabled: true,
            isBiometricEnabled: false,
            lastBackgroundTime: recentTime,
        })

        const { result } = renderHook(() => useAppLock())

        expect(result.current.checkSessionExpired()).toBe(false)
    })
})

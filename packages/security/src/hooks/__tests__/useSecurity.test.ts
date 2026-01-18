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
import { renderHook } from '@testing-library/react'
import { useSecurity } from '../useSecurity'
import { useSecurityStore } from '../../store'

vi.mock('../../store', () => ({
    useSecurityStore: vi.fn(),
}))

describe('useSecurity', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    test('returns security state from store', () => {
        const mockState = {
            isPinEnabled: true,
            isBiometricEnabled: false,
            failedAttempts: 2,
            lockoutEndTime: null,
        }

        vi.mocked(useSecurityStore).mockImplementation(
            (selector: (state: unknown) => unknown) => {
                const fullState = {
                    ...mockState,
                    setIsPinEnabled: vi.fn(),
                    setIsBiometricEnabled: vi.fn(),
                    incrementFailedAttempts: vi.fn(),
                    resetFailedAttempts: vi.fn(),
                    setLockoutEndTime: vi.fn(),
                    setLastBackgroundTime: vi.fn(),
                    reset: vi.fn(),
                }
                return selector(fullState)
            },
        )

        const { result } = renderHook(() => useSecurity())

        expect(result.current.isPinEnabled).toBe(true)
        expect(result.current.isBiometricEnabled).toBe(false)
        expect(result.current.failedAttempts).toBe(2)
        expect(result.current.lockoutEndTime).toBe(null)
        expect(result.current.isLockedOut).toBe(false)
    })

    test('calculates isLockedOut as true when lockout time is in future', () => {
        const futureTime = Date.now() + 30000 // 30 seconds in future

        vi.mocked(useSecurityStore).mockImplementation(
            (selector: (state: unknown) => unknown) => {
                const fullState = {
                    isPinEnabled: true,
                    isBiometricEnabled: false,
                    failedAttempts: 5,
                    lockoutEndTime: futureTime,
                    setIsPinEnabled: vi.fn(),
                    setIsBiometricEnabled: vi.fn(),
                    incrementFailedAttempts: vi.fn(),
                    resetFailedAttempts: vi.fn(),
                    setLockoutEndTime: vi.fn(),
                    setLastBackgroundTime: vi.fn(),
                    reset: vi.fn(),
                }
                return selector(fullState)
            },
        )

        const { result } = renderHook(() => useSecurity())

        expect(result.current.isLockedOut).toBe(true)
        expect(result.current.lockoutEndTime).toBe(futureTime)
    })

    test('calculates isLockedOut as false when lockout time is in past', () => {
        const pastTime = Date.now() - 1000 // 1 second in past

        vi.mocked(useSecurityStore).mockImplementation(
            (selector: (state: unknown) => unknown) => {
                const fullState = {
                    isPinEnabled: true,
                    isBiometricEnabled: false,
                    failedAttempts: 5,
                    lockoutEndTime: pastTime,
                    setIsPinEnabled: vi.fn(),
                    setIsBiometricEnabled: vi.fn(),
                    incrementFailedAttempts: vi.fn(),
                    resetFailedAttempts: vi.fn(),
                    setLockoutEndTime: vi.fn(),
                    setLastBackgroundTime: vi.fn(),
                    reset: vi.fn(),
                }
                return selector(fullState)
            },
        )

        const { result } = renderHook(() => useSecurity())

        expect(result.current.isLockedOut).toBe(false)
    })

    test('calculates isLockedOut as false when lockoutEndTime is null', () => {
        vi.mocked(useSecurityStore).mockImplementation(
            (selector: (state: unknown) => unknown) => {
                const fullState = {
                    isPinEnabled: true,
                    isBiometricEnabled: false,
                    failedAttempts: 3,
                    lockoutEndTime: null,
                    setIsPinEnabled: vi.fn(),
                    setIsBiometricEnabled: vi.fn(),
                    incrementFailedAttempts: vi.fn(),
                    resetFailedAttempts: vi.fn(),
                    setLockoutEndTime: vi.fn(),
                    setLastBackgroundTime: vi.fn(),
                    reset: vi.fn(),
                }
                return selector(fullState)
            },
        )

        const { result } = renderHook(() => useSecurity())

        expect(result.current.isLockedOut).toBe(false)
    })
})

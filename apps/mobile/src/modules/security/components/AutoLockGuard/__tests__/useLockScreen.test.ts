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

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useLockScreen } from '../useLockScreen'
import { usePinCode, useBiometrics } from '@perawallet/wallet-core-security'

vi.mock('@perawallet/wallet-core-security', () => ({
    usePinCode: vi.fn(),
    useBiometrics: vi.fn(),
}))

describe('useLockScreen', () => {
    const mockVerifyPin = vi.fn()
    const mockHandleFailedAttempt = vi.fn()
    const mockResetFailedAttempts = vi.fn()
    const mockSetLockoutEndTime = vi.fn()
    const mockCheckBiometricsEnabled = vi.fn()
    const mockAuthenticateWithBiometrics = vi.fn()
    const mockOnUnlock = vi.fn()

    beforeEach(() => {
        vi.clearAllMocks()
        vi.useFakeTimers()
        mockCheckBiometricsEnabled.mockResolvedValue(false)
        ;(usePinCode as Mock).mockReturnValue({
            verifyPin: mockVerifyPin,
            handleFailedAttempt: mockHandleFailedAttempt,
            resetFailedAttempts: mockResetFailedAttempts,
            isLockedOut: false,
            lockoutEndTime: null,
            setLockoutEndTime: mockSetLockoutEndTime,
        })
        ;(useBiometrics as Mock).mockReturnValue({
            checkBiometricsEnabled: mockCheckBiometricsEnabled,
            authenticateWithBiometrics: mockAuthenticateWithBiometrics,
        })
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('should return initial state', () => {
        const { result } = renderHook(() =>
            useLockScreen({ onUnlock: mockOnUnlock }),
        )

        expect(result.current.hasError).toBe(false)
        expect(result.current.isLockedOut).toBe(false)
        expect(result.current.remainingSeconds).toBe(0)
        expect(typeof result.current.handlePinComplete).toBe('function')
        expect(typeof result.current.handleErrorAnimationComplete).toBe(
            'function',
        )
    })

    it('should check biometrics enabled on mount', async () => {
        mockCheckBiometricsEnabled.mockResolvedValue(false)

        renderHook(() => useLockScreen({ onUnlock: mockOnUnlock }))

        await vi.waitFor(() => {
            expect(mockCheckBiometricsEnabled).toHaveBeenCalled()
        })
    })

    describe('handlePinComplete', () => {
        it('should call onUnlock when PIN is valid', async () => {
            mockVerifyPin.mockResolvedValue(true)

            const { result } = renderHook(() =>
                useLockScreen({ onUnlock: mockOnUnlock }),
            )

            await act(async () => {
                await result.current.handlePinComplete('1234')
            })

            expect(mockVerifyPin).toHaveBeenCalledWith('1234')
            expect(mockResetFailedAttempts).toHaveBeenCalled()
            expect(mockOnUnlock).toHaveBeenCalled()
        })

        it('should handle failed attempt when PIN is invalid', async () => {
            mockVerifyPin.mockResolvedValue(false)

            const { result } = renderHook(() =>
                useLockScreen({ onUnlock: mockOnUnlock }),
            )

            await act(async () => {
                await result.current.handlePinComplete('1234')
            })

            expect(mockHandleFailedAttempt).toHaveBeenCalled()
            expect(result.current.hasError).toBe(true)
            expect(mockOnUnlock).not.toHaveBeenCalled()
        })
    })

    describe('handleErrorAnimationComplete', () => {
        it('should reset hasError to false', async () => {
            mockVerifyPin.mockResolvedValue(false)

            const { result } = renderHook(() =>
                useLockScreen({ onUnlock: mockOnUnlock }),
            )

            await act(async () => {
                await result.current.handlePinComplete('1234')
            })

            expect(result.current.hasError).toBe(true)

            act(() => {
                result.current.handleErrorAnimationComplete()
            })

            expect(result.current.hasError).toBe(false)
        })
    })

    describe('lockout timer', () => {
        it('should calculate remaining seconds when locked out', () => {
            const lockoutEndTime = Date.now() + 60000

            ;(usePinCode as Mock).mockReturnValue({
                verifyPin: mockVerifyPin,
                handleFailedAttempt: mockHandleFailedAttempt,
                resetFailedAttempts: mockResetFailedAttempts,
                isLockedOut: true,
                lockoutEndTime,
                setLockoutEndTime: mockSetLockoutEndTime,
            })

            const { result } = renderHook(() =>
                useLockScreen({ onUnlock: mockOnUnlock }),
            )

            expect(result.current.isLockedOut).toBe(true)
            expect(result.current.remainingSeconds).toBe(60)
        })

        it('should update remaining seconds over time', () => {
            const lockoutEndTime = Date.now() + 60000

            ;(usePinCode as Mock).mockReturnValue({
                verifyPin: mockVerifyPin,
                handleFailedAttempt: mockHandleFailedAttempt,
                resetFailedAttempts: mockResetFailedAttempts,
                isLockedOut: true,
                lockoutEndTime,
                setLockoutEndTime: mockSetLockoutEndTime,
            })

            const { result } = renderHook(() =>
                useLockScreen({ onUnlock: mockOnUnlock }),
            )

            expect(result.current.remainingSeconds).toBe(60)

            act(() => {
                vi.advanceTimersByTime(1000)
            })

            expect(result.current.remainingSeconds).toBe(59)
        })

        it('should call setLockoutEndTime when remaining reaches 0', () => {
            const lockoutEndTime = Date.now() + 1000

            ;(usePinCode as Mock).mockReturnValue({
                verifyPin: mockVerifyPin,
                handleFailedAttempt: mockHandleFailedAttempt,
                resetFailedAttempts: mockResetFailedAttempts,
                isLockedOut: true,
                lockoutEndTime,
                setLockoutEndTime: mockSetLockoutEndTime,
            })

            const { result } = renderHook(() =>
                useLockScreen({ onUnlock: mockOnUnlock }),
            )

            act(() => {
                vi.advanceTimersByTime(1000)
            })

            expect(result.current.remainingSeconds).toBe(0)
            expect(mockSetLockoutEndTime).toHaveBeenCalledWith(null)
        })

        it('should reset remaining seconds when not locked out', () => {
            ;(usePinCode as Mock).mockReturnValue({
                verifyPin: mockVerifyPin,
                handleFailedAttempt: mockHandleFailedAttempt,
                resetFailedAttempts: mockResetFailedAttempts,
                isLockedOut: false,
                lockoutEndTime: null,
                setLockoutEndTime: mockSetLockoutEndTime,
            })

            const { result } = renderHook(() =>
                useLockScreen({ onUnlock: mockOnUnlock }),
            )

            expect(result.current.remainingSeconds).toBe(0)
        })
    })
})

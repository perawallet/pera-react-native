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
import { renderHook, act, waitFor } from '@testing-library/react'
import { usePinEditView } from '../usePinEditView'
import { usePinCode, useBiometrics } from '@perawallet/wallet-core-security'
import { useLanguage } from '@hooks/useLanguage'

vi.mock('@perawallet/wallet-core-security', () => ({
    usePinCode: vi.fn(),
    useBiometrics: vi.fn(),
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: vi.fn(),
}))

describe('usePinEditView', () => {
    const mockSavePin = vi.fn()
    const mockVerifyPin = vi.fn()
    const mockHandleFailedAttempt = vi.fn()
    const mockResetFailedAttempts = vi.fn()
    const mockCheckBiometricsEnabled = vi.fn()
    const mockAuthenticateWithBiometrics = vi.fn()
    const mockOnSuccess = vi.fn()
    const mockT = vi.fn((key: string) => key)

    beforeEach(() => {
        vi.clearAllMocks()
        ;(usePinCode as Mock).mockReturnValue({
            savePin: mockSavePin,
            verifyPin: mockVerifyPin,
            handleFailedAttempt: mockHandleFailedAttempt,
            resetFailedAttempts: mockResetFailedAttempts,
            isLockedOut: false,
        })
        ;(useBiometrics as Mock).mockReturnValue({
            checkBiometricsEnabled: mockCheckBiometricsEnabled,
            authenticateWithBiometrics: mockAuthenticateWithBiometrics,
        })
        ;(useLanguage as Mock).mockReturnValue({
            t: mockT,
        })
    })

    describe('initial state', () => {
        it('should return setup title when mode is setup', () => {
            const { result } = renderHook(() =>
                usePinEditView({ mode: 'setup', onSuccess: mockOnSuccess }),
            )

            expect(result.current.title).toBe('security.pin.setup_title')
        })

        it('should return confirm title when mode is confirm', () => {
            const { result } = renderHook(() =>
                usePinEditView({ mode: 'confirm', onSuccess: mockOnSuccess }),
            )

            expect(result.current.title).toBe('security.pin.confirm_title')
        })

        it('should return verify title when mode is verify', () => {
            const { result } = renderHook(() =>
                usePinEditView({ mode: 'verify', onSuccess: mockOnSuccess }),
            )

            expect(result.current.title).toBe('security.pin.verify_title')
        })

        it('should return change_old title when mode is change_old', () => {
            const { result } = renderHook(() =>
                usePinEditView({
                    mode: 'change_old',
                    onSuccess: mockOnSuccess,
                }),
            )

            expect(result.current.title).toBe('security.pin.change_old_title')
        })

        it('should return empty title when mode is null', () => {
            const { result } = renderHook(() =>
                usePinEditView({ mode: null, onSuccess: mockOnSuccess }),
            )

            expect(result.current.title).toBe('')
        })

        it('should return hasError as false initially', () => {
            const { result } = renderHook(() =>
                usePinEditView({ mode: 'setup', onSuccess: mockOnSuccess }),
            )

            expect(result.current.hasError).toBe(false)
        })

        it('should return isDisabled based on isLockedOut', () => {
            ;(usePinCode as Mock).mockReturnValue({
                savePin: mockSavePin,
                verifyPin: mockVerifyPin,
                handleFailedAttempt: mockHandleFailedAttempt,
                resetFailedAttempts: mockResetFailedAttempts,
                isLockedOut: true,
            })

            const { result } = renderHook(() =>
                usePinEditView({ mode: 'setup', onSuccess: mockOnSuccess }),
            )

            expect(result.current.isDisabled).toBe(true)
        })
    })

    describe('handlePinComplete in setup mode', () => {
        it('should store PIN and transition to confirm mode', async () => {
            const { result } = renderHook(() =>
                usePinEditView({ mode: 'setup', onSuccess: mockOnSuccess }),
            )

            await act(async () => {
                await result.current.handlePinComplete('1234')
            })

            expect(result.current.title).toBe('security.pin.confirm_title')
            expect(result.current.hasError).toBe(false)
        })
    })

    describe('handlePinComplete in confirm mode', () => {
        it('should save PIN and call onSuccess when PINs match', async () => {
            mockSavePin.mockResolvedValue(undefined)

            const { result } = renderHook(() =>
                usePinEditView({ mode: 'setup', onSuccess: mockOnSuccess }),
            )

            await act(async () => {
                await result.current.handlePinComplete('1234')
            })

            await act(async () => {
                await result.current.handlePinComplete('1234')
            })

            expect(mockSavePin).toHaveBeenCalledWith('1234')
            expect(mockOnSuccess).toHaveBeenCalled()
        })

        it('should set hasError when PINs do not match', async () => {
            const { result } = renderHook(() =>
                usePinEditView({ mode: 'setup', onSuccess: mockOnSuccess }),
            )

            await act(async () => {
                await result.current.handlePinComplete('1234')
            })

            await act(async () => {
                await result.current.handlePinComplete('5678')
            })

            expect(result.current.hasError).toBe(true)
            expect(mockSavePin).not.toHaveBeenCalled()
            expect(mockOnSuccess).not.toHaveBeenCalled()
        })
    })

    describe('handlePinComplete in verify mode', () => {
        it('should call onSuccess when PIN is valid', async () => {
            mockVerifyPin.mockResolvedValue(true)

            const { result } = renderHook(() =>
                usePinEditView({ mode: 'verify', onSuccess: mockOnSuccess }),
            )

            await act(async () => {
                await result.current.handlePinComplete('1234')
            })

            expect(mockVerifyPin).toHaveBeenCalledWith('1234')
            expect(mockResetFailedAttempts).toHaveBeenCalled()
            expect(mockOnSuccess).toHaveBeenCalled()
        })

        it('should handle failed attempt when PIN is invalid', async () => {
            mockVerifyPin.mockResolvedValue(false)

            const { result } = renderHook(() =>
                usePinEditView({ mode: 'verify', onSuccess: mockOnSuccess }),
            )

            await act(async () => {
                await result.current.handlePinComplete('1234')
            })

            expect(mockHandleFailedAttempt).toHaveBeenCalled()
            expect(result.current.hasError).toBe(true)
            expect(mockOnSuccess).not.toHaveBeenCalled()
        })
    })

    describe('handlePinComplete in change_old mode', () => {
        it('should transition to setup mode when PIN is valid', async () => {
            mockVerifyPin.mockResolvedValue(true)

            const { result } = renderHook(() =>
                usePinEditView({
                    mode: 'change_old',
                    onSuccess: mockOnSuccess,
                }),
            )

            await act(async () => {
                await result.current.handlePinComplete('1234')
            })

            expect(mockVerifyPin).toHaveBeenCalledWith('1234')
            expect(mockResetFailedAttempts).toHaveBeenCalled()
            expect(result.current.title).toBe('security.pin.setup_title')
            expect(mockOnSuccess).not.toHaveBeenCalled()
        })

        it('should handle failed attempt when PIN is invalid', async () => {
            mockVerifyPin.mockResolvedValue(false)

            const { result } = renderHook(() =>
                usePinEditView({
                    mode: 'change_old',
                    onSuccess: mockOnSuccess,
                }),
            )

            await act(async () => {
                await result.current.handlePinComplete('1234')
            })

            expect(mockHandleFailedAttempt).toHaveBeenCalled()
            expect(result.current.hasError).toBe(true)
        })
    })

    describe('handleBiometricPress', () => {
        it('should call onSuccess when biometrics is enabled and authentication succeeds', async () => {
            mockCheckBiometricsEnabled.mockResolvedValue(true)
            mockAuthenticateWithBiometrics.mockResolvedValue(true)

            const { result } = renderHook(() =>
                usePinEditView({ mode: 'verify', onSuccess: mockOnSuccess }),
            )

            await act(async () => {
                await result.current.handleBiometricPress()
            })

            expect(mockCheckBiometricsEnabled).toHaveBeenCalled()
            expect(mockAuthenticateWithBiometrics).toHaveBeenCalled()
            expect(mockResetFailedAttempts).toHaveBeenCalled()
            expect(mockOnSuccess).toHaveBeenCalled()
        })

        it('should not authenticate when biometrics is not enabled', async () => {
            mockCheckBiometricsEnabled.mockResolvedValue(false)

            const { result } = renderHook(() =>
                usePinEditView({ mode: 'verify', onSuccess: mockOnSuccess }),
            )

            await act(async () => {
                await result.current.handleBiometricPress()
            })

            expect(mockCheckBiometricsEnabled).toHaveBeenCalled()
            expect(mockAuthenticateWithBiometrics).not.toHaveBeenCalled()
            expect(mockOnSuccess).not.toHaveBeenCalled()
        })

        it('should not call onSuccess when authentication fails', async () => {
            mockCheckBiometricsEnabled.mockResolvedValue(true)
            mockAuthenticateWithBiometrics.mockResolvedValue(false)

            const { result } = renderHook(() =>
                usePinEditView({ mode: 'verify', onSuccess: mockOnSuccess }),
            )

            await act(async () => {
                await result.current.handleBiometricPress()
            })

            expect(mockOnSuccess).not.toHaveBeenCalled()
        })
    })

    describe('handleErrorAnimationComplete', () => {
        it('should reset hasError to false', async () => {
            mockVerifyPin.mockResolvedValue(false)

            const { result } = renderHook(() =>
                usePinEditView({ mode: 'verify', onSuccess: mockOnSuccess }),
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

    describe('mode changes', () => {
        it('should update currentMode when mode prop changes', async () => {
            const { result, rerender } = renderHook(
                ({ mode }) =>
                    usePinEditView({ mode, onSuccess: mockOnSuccess }),
                { initialProps: { mode: 'setup' as const } },
            )

            expect(result.current.title).toBe('security.pin.setup_title')

            rerender({ mode: 'verify' as const })

            await waitFor(() => {
                expect(result.current.title).toBe('security.pin.verify_title')
            })
        })
    })
})

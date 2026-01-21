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
import { useSettingsSecurityScreen } from '../useSettingsSecurityScreen'
import { usePinCode, useBiometrics } from '@perawallet/wallet-core-security'
import { usePreferences } from '@perawallet/wallet-core-settings'

vi.mock('@perawallet/wallet-core-security', () => ({
    usePinCode: vi.fn(),
    useBiometrics: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-settings', () => ({
    usePreferences: vi.fn(),
}))

describe('useSettingsSecurityScreen', () => {
    const mockCheckPinEnabled = vi.fn()
    const mockSavePin = vi.fn()
    const mockCheckBiometricsEnabled = vi.fn()
    const mockCheckBiometricsAvailable = vi.fn()
    const mockEnableBiometrics = vi.fn()
    const mockDisableBiometrics = vi.fn()
    const mockSetPreference = vi.fn()

    beforeEach(() => {
        vi.clearAllMocks()
        mockCheckPinEnabled.mockResolvedValue(false)
        mockCheckBiometricsEnabled.mockResolvedValue(false)
        mockCheckBiometricsAvailable.mockResolvedValue(false)
        ;(usePinCode as Mock).mockReturnValue({
            checkPinEnabled: mockCheckPinEnabled,
            savePin: mockSavePin,
        })
        ;(useBiometrics as Mock).mockReturnValue({
            checkBiometricsEnabled: mockCheckBiometricsEnabled,
            checkBiometricsAvailable: mockCheckBiometricsAvailable,
            enableBiometrics: mockEnableBiometrics,
            disableBiometrics: mockDisableBiometrics,
        })
        ;(usePreferences as Mock).mockReturnValue({
            setPreference: mockSetPreference,
        })
    })

    it('should return initial state', async () => {
        const { result } = renderHook(() => useSettingsSecurityScreen())

        await waitFor(() => {
            expect(result.current.isPinEnabled).toBe(false)
        })

        expect(result.current.isBiometricEnabled).toBe(false)
        expect(result.current.isBiometricsAvailable).toBe(false)
        expect(result.current.pinViewMode).toBeNull()
    })

    it('should check settings on mount', async () => {
        renderHook(() => useSettingsSecurityScreen())

        await waitFor(() => {
            expect(mockCheckPinEnabled).toHaveBeenCalled()
        })

        expect(mockCheckBiometricsEnabled).toHaveBeenCalled()
        expect(mockCheckBiometricsAvailable).toHaveBeenCalled()
    })

    it('should update isPinEnabled when checkPinEnabled returns true', async () => {
        mockCheckPinEnabled.mockResolvedValue(true)

        const { result } = renderHook(() => useSettingsSecurityScreen())

        await waitFor(() => {
            expect(result.current.isPinEnabled).toBe(true)
        })
    })

    it('should update isBiometricEnabled when checkBiometricsEnabled returns true', async () => {
        mockCheckBiometricsEnabled.mockResolvedValue(true)

        const { result } = renderHook(() => useSettingsSecurityScreen())

        await waitFor(() => {
            expect(result.current.isBiometricEnabled).toBe(true)
        })
    })

    it('should update isBiometricsAvailable when checkBiometricsAvailable returns true', async () => {
        mockCheckBiometricsAvailable.mockResolvedValue(true)

        const { result } = renderHook(() => useSettingsSecurityScreen())

        await waitFor(() => {
            expect(result.current.isBiometricsAvailable).toBe(true)
        })
    })

    describe('handlePinToggle', () => {
        it('should set pinViewMode to setup when enabling PIN', async () => {
            const { result } = renderHook(() => useSettingsSecurityScreen())

            await waitFor(() => {
                expect(mockCheckPinEnabled).toHaveBeenCalled()
            })

            act(() => {
                result.current.handlePinToggle(true)
            })

            expect(result.current.pinViewMode).toBe('setup')
        })

        it('should set pinViewMode to verify when disabling PIN', async () => {
            const { result } = renderHook(() => useSettingsSecurityScreen())

            await waitFor(() => {
                expect(mockCheckPinEnabled).toHaveBeenCalled()
            })

            act(() => {
                result.current.handlePinToggle(false)
            })

            expect(result.current.pinViewMode).toBe('verify')
        })
    })

    describe('handleBiometricToggle', () => {
        it('should call enableBiometrics when enabling biometrics', async () => {
            mockEnableBiometrics.mockResolvedValue(true)

            const { result } = renderHook(() => useSettingsSecurityScreen())

            await waitFor(() => {
                expect(mockCheckPinEnabled).toHaveBeenCalled()
            })

            let success: boolean
            await act(async () => {
                success = await result.current.handleBiometricToggle(true)
            })

            expect(mockEnableBiometrics).toHaveBeenCalled()
            expect(success!).toBe(true)
        })

        it('should call disableBiometrics when disabling biometrics', async () => {
            mockDisableBiometrics.mockResolvedValue(undefined)

            const { result } = renderHook(() => useSettingsSecurityScreen())

            await waitFor(() => {
                expect(mockCheckPinEnabled).toHaveBeenCalled()
            })

            let success: boolean
            await act(async () => {
                success = await result.current.handleBiometricToggle(false)
            })

            expect(mockDisableBiometrics).toHaveBeenCalled()
            expect(success!).toBe(true)
        })

        it('should return false when enableBiometrics fails', async () => {
            mockEnableBiometrics.mockResolvedValue(false)

            const { result } = renderHook(() => useSettingsSecurityScreen())

            await waitFor(() => {
                expect(mockCheckPinEnabled).toHaveBeenCalled()
            })

            let success: boolean
            await act(async () => {
                success = await result.current.handleBiometricToggle(true)
            })

            expect(success!).toBe(false)
        })
    })

    describe('handleChangePinPress', () => {
        it('should set pinViewMode to change_old', async () => {
            const { result } = renderHook(() => useSettingsSecurityScreen())

            await waitFor(() => {
                expect(mockCheckPinEnabled).toHaveBeenCalled()
            })

            act(() => {
                result.current.handleChangePinPress()
            })

            expect(result.current.pinViewMode).toBe('change_old')
        })
    })

    describe('pinSetSuccess', () => {
        it('should clear PIN when pinViewMode is verify', async () => {
            const { result } = renderHook(() => useSettingsSecurityScreen())

            await waitFor(() => {
                expect(mockCheckPinEnabled).toHaveBeenCalled()
            })

            act(() => {
                result.current.handlePinToggle(false)
            })

            expect(result.current.pinViewMode).toBe('verify')

            await act(async () => {
                result.current.pinSetSuccess()
            })

            expect(mockSavePin).toHaveBeenCalledWith(null)
            expect(result.current.pinViewMode).toBeNull()
        })

        it('should not clear PIN when pinViewMode is setup', async () => {
            const { result } = renderHook(() => useSettingsSecurityScreen())

            await waitFor(() => {
                expect(mockCheckPinEnabled).toHaveBeenCalled()
            })

            act(() => {
                result.current.handlePinToggle(true)
            })

            expect(result.current.pinViewMode).toBe('setup')

            await act(async () => {
                result.current.pinSetSuccess()
            })

            expect(mockSavePin).not.toHaveBeenCalled()
            expect(result.current.pinViewMode).toBeNull()
        })

        it('should set preference and update settings', async () => {
            const { result } = renderHook(() => useSettingsSecurityScreen())

            await waitFor(() => {
                expect(mockCheckPinEnabled).toHaveBeenCalled()
            })

            act(() => {
                result.current.handlePinToggle(true)
            })

            await act(async () => {
                result.current.pinSetSuccess()
            })

            expect(mockSetPreference).toHaveBeenCalled()
        })
    })

    describe('clearPinViewMode', () => {
        it('should set pinViewMode to null', async () => {
            const { result } = renderHook(() => useSettingsSecurityScreen())

            await waitFor(() => {
                expect(mockCheckPinEnabled).toHaveBeenCalled()
            })

            act(() => {
                result.current.handlePinToggle(true)
            })

            expect(result.current.pinViewMode).toBe('setup')

            act(() => {
                result.current.clearPinViewMode()
            })

            expect(result.current.pinViewMode).toBeNull()
        })
    })
})

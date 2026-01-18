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
import { useBiometrics } from '../useBiometrics'
import { useSecurityStore } from '../../store'
import { useSecureStorageService } from '@perawallet/wallet-core-platform-integration'
import { PIN_STORAGE_KEY, BIOMETRIC_STORAGE_KEY } from '../../models'

vi.mock('../../store', () => ({
    useSecurityStore: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-platform-integration', () => ({
    useSecureStorageService: vi.fn(),
}))

describe('useBiometrics', () => {
    const mockSetIsBiometricEnabled = vi.fn()
    const mockGetItem = vi.fn()
    const mockSetItem = vi.fn()
    const mockRemoveItem = vi.fn()

    beforeEach(() => {
        vi.clearAllMocks()

        vi.mocked(useSecureStorageService).mockReturnValue({
            getItem: mockGetItem,
            setItem: mockSetItem,
            removeItem: mockRemoveItem,
        } as unknown as ReturnType<typeof useSecureStorageService>)
    })

    const setupMock = (state: {
        isPinEnabled: boolean
        isBiometricEnabled: boolean
    }) => {
        vi.mocked(useSecurityStore).mockImplementation(
            (selector: (state: unknown) => unknown) => {
                const fullState = {
                    ...state,
                    failedAttempts: 0,
                    lockoutEndTime: null,
                    lastBackgroundTime: null,
                    setIsPinEnabled: vi.fn(),
                    setIsBiometricEnabled: mockSetIsBiometricEnabled,
                    incrementFailedAttempts: vi.fn(),
                    resetFailedAttempts: vi.fn(),
                    setLockoutEndTime: vi.fn(),
                    setLastBackgroundTime: vi.fn(),
                    reset: vi.fn(),
                }
                return selector(fullState)
            },
        )
    }

    test('returns correct biometric enabled state', () => {
        setupMock({
            isPinEnabled: true,
            isBiometricEnabled: true,
        })

        const { result } = renderHook(() => useBiometrics())

        expect(result.current.isBiometricEnabled).toBe(true)
    })

    test('enableBiometrics returns false when PIN is not enabled', async () => {
        setupMock({
            isPinEnabled: false,
            isBiometricEnabled: false,
        })

        const { result } = renderHook(() => useBiometrics())

        let success: boolean = true
        await act(async () => {
            success = await result.current.enableBiometrics()
        })

        expect(success).toBe(false)
        expect(mockGetItem).not.toHaveBeenCalled()
        expect(mockSetIsBiometricEnabled).not.toHaveBeenCalled()
    })

    test('enableBiometrics returns false when PIN data not found', async () => {
        setupMock({
            isPinEnabled: true,
            isBiometricEnabled: false,
        })

        mockGetItem.mockResolvedValue(null)

        const { result } = renderHook(() => useBiometrics())

        let success: boolean = true
        await act(async () => {
            success = await result.current.enableBiometrics()
        })

        expect(success).toBe(false)
        expect(mockGetItem).toHaveBeenCalledWith(PIN_STORAGE_KEY)
        expect(mockSetIsBiometricEnabled).not.toHaveBeenCalled()
    })

    test('enableBiometrics successfully copies PIN to biometric storage', async () => {
        setupMock({
            isPinEnabled: true,
            isBiometricEnabled: false,
        })

        const pinData = new TextEncoder().encode('123456')
        mockGetItem.mockResolvedValue(pinData)

        const { result } = renderHook(() => useBiometrics())

        let success: boolean = false
        await act(async () => {
            success = await result.current.enableBiometrics()
        })

        expect(success).toBe(true)
        expect(mockGetItem).toHaveBeenCalledWith(PIN_STORAGE_KEY)
        expect(mockSetItem).toHaveBeenCalledWith(BIOMETRIC_STORAGE_KEY, pinData)
        expect(mockSetIsBiometricEnabled).toHaveBeenCalledWith(true)
    })

    test('enableBiometrics returns false on error', async () => {
        setupMock({
            isPinEnabled: true,
            isBiometricEnabled: false,
        })

        mockGetItem.mockRejectedValue(new Error('Storage error'))

        const { result } = renderHook(() => useBiometrics())

        let success: boolean = true
        await act(async () => {
            success = await result.current.enableBiometrics()
        })

        expect(success).toBe(false)
        expect(mockSetIsBiometricEnabled).not.toHaveBeenCalled()
    })

    test('disableBiometrics removes biometric data and updates state', async () => {
        setupMock({
            isPinEnabled: true,
            isBiometricEnabled: true,
        })

        const { result } = renderHook(() => useBiometrics())

        await act(async () => {
            await result.current.disableBiometrics()
        })

        expect(mockRemoveItem).toHaveBeenCalledWith(BIOMETRIC_STORAGE_KEY)
        expect(mockSetIsBiometricEnabled).toHaveBeenCalledWith(false)
    })

    test('authenticateWithBiometrics returns false when biometrics not enabled', async () => {
        setupMock({
            isPinEnabled: true,
            isBiometricEnabled: false,
        })

        const { result } = renderHook(() => useBiometrics())

        let authenticated: boolean = true
        await act(async () => {
            authenticated = await result.current.authenticateWithBiometrics()
        })

        expect(authenticated).toBe(false)
        expect(mockGetItem).not.toHaveBeenCalled()
    })

    test('authenticateWithBiometrics returns false when PIN data missing', async () => {
        setupMock({
            isPinEnabled: true,
            isBiometricEnabled: true,
        })

        mockGetItem.mockResolvedValueOnce(null).mockResolvedValueOnce(null)

        const { result } = renderHook(() => useBiometrics())

        let authenticated: boolean = true
        await act(async () => {
            authenticated = await result.current.authenticateWithBiometrics()
        })

        expect(authenticated).toBe(false)
    })

    test('authenticateWithBiometrics returns false when biometric data missing', async () => {
        setupMock({
            isPinEnabled: true,
            isBiometricEnabled: true,
        })

        const pinData = new TextEncoder().encode('123456')
        mockGetItem.mockResolvedValueOnce(pinData).mockResolvedValueOnce(null)

        const { result } = renderHook(() => useBiometrics())

        let authenticated: boolean = true
        await act(async () => {
            authenticated = await result.current.authenticateWithBiometrics()
        })

        expect(authenticated).toBe(false)
    })

    test('authenticateWithBiometrics returns true when PINs match', async () => {
        setupMock({
            isPinEnabled: true,
            isBiometricEnabled: true,
        })

        const pinData = new TextEncoder().encode('123456')
        mockGetItem
            .mockResolvedValueOnce(pinData)
            .mockResolvedValueOnce(pinData)

        const { result } = renderHook(() => useBiometrics())

        let authenticated: boolean = false
        await act(async () => {
            authenticated = await result.current.authenticateWithBiometrics()
        })

        expect(authenticated).toBe(true)
        expect(mockGetItem).toHaveBeenCalledWith(PIN_STORAGE_KEY)
        expect(mockGetItem).toHaveBeenCalledWith(BIOMETRIC_STORAGE_KEY)
    })

    test('authenticateWithBiometrics returns false when PINs do not match', async () => {
        setupMock({
            isPinEnabled: true,
            isBiometricEnabled: true,
        })

        const pinData = new TextEncoder().encode('123456')
        const wrongPinData = new TextEncoder().encode('654321')
        mockGetItem
            .mockResolvedValueOnce(pinData)
            .mockResolvedValueOnce(wrongPinData)

        const { result } = renderHook(() => useBiometrics())

        let authenticated: boolean = true
        await act(async () => {
            authenticated = await result.current.authenticateWithBiometrics()
        })

        expect(authenticated).toBe(false)
    })

    test('authenticateWithBiometrics returns false on error', async () => {
        setupMock({
            isPinEnabled: true,
            isBiometricEnabled: true,
        })

        mockGetItem.mockRejectedValue(new Error('Storage error'))

        const { result } = renderHook(() => useBiometrics())

        let authenticated: boolean = true
        await act(async () => {
            authenticated = await result.current.authenticateWithBiometrics()
        })

        expect(authenticated).toBe(false)
    })
})

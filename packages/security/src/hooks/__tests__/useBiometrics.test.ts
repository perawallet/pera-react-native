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
import {
    useSecureStorageService,
    useBiometricsService,
} from '@perawallet/wallet-core-platform-integration'
import { PIN_STORAGE_KEY, BIOMETRIC_STORAGE_KEY } from '../../constants'

vi.mock('@perawallet/wallet-core-platform-integration', () => ({
    useSecureStorageService: vi.fn(),
    useBiometricsService: vi.fn(),
}))

describe('useBiometrics', () => {
    const mockGetItem = vi.fn()
    const mockSetItem = vi.fn()
    const mockRemoveItem = vi.fn()
    const mockCheckBiometricsAvailable = vi.fn()
    const mockAuthenticate = vi.fn()

    beforeEach(() => {
        vi.clearAllMocks()

        vi.mocked(useSecureStorageService).mockReturnValue({
            getItem: mockGetItem,
            setItem: mockSetItem,
            removeItem: mockRemoveItem,
        } as unknown as ReturnType<typeof useSecureStorageService>)

        vi.mocked(useBiometricsService).mockReturnValue({
            checkBiometricsAvailable: mockCheckBiometricsAvailable,
            authenticate: mockAuthenticate,
        } as unknown as ReturnType<typeof useBiometricsService>)
    })

    test('checkBiometricsEnabled returns true when biometric data exists', async () => {
        const biometricData = new TextEncoder().encode('123456')
        mockGetItem.mockResolvedValue(biometricData)

        const { result } = renderHook(() => useBiometrics())

        let isEnabled: boolean = false
        await act(async () => {
            isEnabled = await result.current.checkBiometricsEnabled()
        })

        expect(isEnabled).toBe(true)
        expect(mockGetItem).toHaveBeenCalledWith(BIOMETRIC_STORAGE_KEY)
    })

    test('checkBiometricsEnabled returns false when no biometric data', async () => {
        mockGetItem.mockResolvedValue(null)

        const { result } = renderHook(() => useBiometrics())

        let isEnabled: boolean = true
        await act(async () => {
            isEnabled = await result.current.checkBiometricsEnabled()
        })

        expect(isEnabled).toBe(false)
        expect(mockGetItem).toHaveBeenCalledWith(BIOMETRIC_STORAGE_KEY)
    })

    test('checkBiometricsAvailable returns true when available', async () => {
        mockCheckBiometricsAvailable.mockResolvedValue(true)

        const { result } = renderHook(() => useBiometrics())

        let isAvailable: boolean = false
        await act(async () => {
            isAvailable = await result.current.checkBiometricsAvailable()
        })

        expect(isAvailable).toBe(true)
        expect(mockCheckBiometricsAvailable).toHaveBeenCalled()
    })

    test('checkBiometricsAvailable returns false when not available', async () => {
        mockCheckBiometricsAvailable.mockResolvedValue(false)

        const { result } = renderHook(() => useBiometrics())

        let isAvailable: boolean = true
        await act(async () => {
            isAvailable = await result.current.checkBiometricsAvailable()
        })

        expect(isAvailable).toBe(false)
        expect(mockCheckBiometricsAvailable).toHaveBeenCalled()
    })

    test('setBiometricsCode stores biometric code', async () => {
        const { result } = renderHook(() => useBiometrics())

        const code = new TextEncoder().encode('123456')

        await act(async () => {
            await result.current.setBiometricsCode(code)
        })

        expect(mockSetItem).toHaveBeenCalledWith(BIOMETRIC_STORAGE_KEY, code)
    })

    test('enableBiometrics returns false when PIN is not enabled', async () => {
        mockGetItem.mockResolvedValue(null)

        const { result } = renderHook(() => useBiometrics())

        let success: boolean = true
        await act(async () => {
            success = await result.current.enableBiometrics()
        })

        expect(success).toBe(false)
        expect(mockGetItem).toHaveBeenCalledWith(PIN_STORAGE_KEY)
    })

    test('enableBiometrics returns false when PIN data not found', async () => {
        mockGetItem.mockResolvedValue(null)

        const { result } = renderHook(() => useBiometrics())

        let success: boolean = true
        await act(async () => {
            success = await result.current.enableBiometrics()
        })

        expect(success).toBe(false)
        expect(mockGetItem).toHaveBeenCalledWith(PIN_STORAGE_KEY)
    })

    test('enableBiometrics successfully copies PIN to biometric storage', async () => {
        const pinData = new TextEncoder().encode('123456')
        mockGetItem.mockResolvedValue(pinData)
        mockCheckBiometricsAvailable.mockResolvedValue(true)
        mockAuthenticate.mockResolvedValue(true)

        const { result } = renderHook(() => useBiometrics())

        let success: boolean = false
        await act(async () => {
            success = await result.current.enableBiometrics()
        })

        expect(success).toBe(true)
        expect(mockGetItem).toHaveBeenCalledWith(PIN_STORAGE_KEY)
        expect(mockCheckBiometricsAvailable).toHaveBeenCalled()
        expect(mockAuthenticate).toHaveBeenCalled()
        expect(mockSetItem).toHaveBeenCalledWith(BIOMETRIC_STORAGE_KEY, pinData)
    })

    test('enableBiometrics returns false on error', async () => {
        const pinData = new TextEncoder().encode('123456')
        mockGetItem.mockResolvedValue(pinData)
        mockCheckBiometricsAvailable.mockResolvedValue(true)
        mockAuthenticate.mockRejectedValue(new Error('Auth error'))

        const { result } = renderHook(() => useBiometrics())

        let success: boolean = true
        await act(async () => {
            success = await result.current.enableBiometrics()
        })

        expect(success).toBe(false)
    })

    test('disableBiometrics removes biometric data and updates state', async () => {
        const { result } = renderHook(() => useBiometrics())

        await act(async () => {
            await result.current.disableBiometrics()
        })

        expect(mockRemoveItem).toHaveBeenCalledWith(BIOMETRIC_STORAGE_KEY)
    })

    test('authenticateWithBiometrics returns false when biometrics not enabled', async () => {
        mockGetItem.mockResolvedValue(null)

        const { result } = renderHook(() => useBiometrics())

        let authenticated: boolean = true
        await act(async () => {
            authenticated = await result.current.authenticateWithBiometrics()
        })

        expect(authenticated).toBe(false)
        expect(mockAuthenticate).not.toHaveBeenCalled()
    })

    test('authenticateWithBiometrics returns false when PIN data missing', async () => {
        const biometricData = new TextEncoder().encode('123456')
        mockGetItem
            .mockResolvedValueOnce(biometricData) // checkBiometricsEnabled
            .mockResolvedValueOnce(null) // PIN_STORAGE_KEY
            .mockResolvedValueOnce(biometricData) // BIOMETRIC_STORAGE_KEY
        mockAuthenticate.mockResolvedValue(true)

        const { result } = renderHook(() => useBiometrics())

        let authenticated: boolean = true
        await act(async () => {
            authenticated = await result.current.authenticateWithBiometrics()
        })

        expect(authenticated).toBe(false)
    })

    test('authenticateWithBiometrics returns false when biometric data missing', async () => {
        const pinData = new TextEncoder().encode('123456')
        mockGetItem
            .mockResolvedValueOnce(pinData) // checkBiometricsEnabled
            .mockResolvedValueOnce(pinData) // PIN_STORAGE_KEY
            .mockResolvedValueOnce(null) // BIOMETRIC_STORAGE_KEY
        mockAuthenticate.mockResolvedValue(true)

        const { result } = renderHook(() => useBiometrics())

        let authenticated: boolean = true
        await act(async () => {
            authenticated = await result.current.authenticateWithBiometrics()
        })

        expect(authenticated).toBe(false)
    })

    test('authenticateWithBiometrics returns true when PINs match', async () => {
        const pinData = new TextEncoder().encode('123456')
        mockGetItem
            .mockResolvedValueOnce(pinData) // checkBiometricsEnabled
            .mockResolvedValueOnce(pinData) // PIN_STORAGE_KEY
            .mockResolvedValueOnce(pinData) // BIOMETRIC_STORAGE_KEY
        mockAuthenticate.mockResolvedValue(true)

        const { result } = renderHook(() => useBiometrics())

        let authenticated: boolean = false
        await act(async () => {
            authenticated = await result.current.authenticateWithBiometrics()
        })

        expect(authenticated).toBe(true)
        expect(mockAuthenticate).toHaveBeenCalled()
    })

    test('authenticateWithBiometrics returns false when PINs do not match', async () => {
        const pinData = new TextEncoder().encode('123456')
        const wrongPinData = new TextEncoder().encode('654321')
        mockGetItem
            .mockResolvedValueOnce(pinData) // checkBiometricsEnabled
            .mockResolvedValueOnce(pinData) // PIN_STORAGE_KEY
            .mockResolvedValueOnce(wrongPinData) // BIOMETRIC_STORAGE_KEY
        mockAuthenticate.mockResolvedValue(true)

        const { result } = renderHook(() => useBiometrics())

        let authenticated: boolean = true
        await act(async () => {
            authenticated = await result.current.authenticateWithBiometrics()
        })

        expect(authenticated).toBe(false)
    })

    test('authenticateWithBiometrics returns false on error', async () => {
        const biometricData = new TextEncoder().encode('123456')
        mockGetItem.mockResolvedValueOnce(biometricData) // checkBiometricsEnabled
        mockAuthenticate.mockRejectedValue(new Error('Auth error'))

        const { result } = renderHook(() => useBiometrics())

        let authenticated: boolean = true
        await act(async () => {
            authenticated = await result.current.authenticateWithBiometrics()
        })

        expect(authenticated).toBe(false)
    })
})

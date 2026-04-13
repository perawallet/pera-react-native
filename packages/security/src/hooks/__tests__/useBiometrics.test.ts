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
import { renderHook, act, waitFor } from '@testing-library/react'
import { useBiometrics } from '../useBiometrics'
import { PIN_STORAGE_KEY, BIOMETRIC_STORAGE_KEY } from '../../constants'

const mockGetItem = vi.fn()
const mockSetItem = vi.fn()
const mockRemoveItem = vi.fn()
const mockCheckBiometricsAvailable = vi.fn()
const mockAuthenticate = vi.fn()

const mockSecureStorage = {
    getItem: mockGetItem,
    setItem: mockSetItem,
    removeItem: mockRemoveItem,
}

const mockBiometricsService = {
    checkBiometricsAvailable: mockCheckBiometricsAvailable,
    authenticate: mockAuthenticate,
    getSupportedBiometricType: vi.fn(),
}

vi.mock('@perawallet/wallet-extension-provider', () => ({
    getProvider: () => ({
        secureStorage: mockSecureStorage,
        biometrics: mockBiometricsService,
    }),
}))

/**
 * Helper to render the hook and flush the initial useEffect that reads
 * isEnabled / isAvailable from storage on mount.
 */
const renderAndSettle = async () => {
    const hook = renderHook(() => useBiometrics())
    await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0))
    })
    return hook
}

describe('useBiometrics', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockGetItem.mockResolvedValue(null)
        mockCheckBiometricsAvailable.mockResolvedValue(false)
    })

    test('initializes isEnabled from secure storage on mount', async () => {
        const biometricData = new TextEncoder().encode('123456')
        mockGetItem.mockResolvedValue(biometricData)

        const { result } = renderHook(() => useBiometrics())

        expect(result.current.isEnabled).toBe(false)

        await waitFor(() => {
            expect(result.current.isEnabled).toBe(true)
        })
    })

    test('initializes isAvailable from biometrics service on mount', async () => {
        mockCheckBiometricsAvailable.mockResolvedValue(true)

        const { result } = renderHook(() => useBiometrics())

        expect(result.current.isAvailable).toBe(false)

        await waitFor(() => {
            expect(result.current.isAvailable).toBe(true)
        })
    })

    test('checkBiometricsEnabled returns true when biometric data exists', async () => {
        const biometricData = new TextEncoder().encode('123456')
        mockGetItem.mockResolvedValue(biometricData)

        const { result } = await renderAndSettle()

        let isEnabled: boolean = false
        await act(async () => {
            isEnabled = await result.current.checkBiometricsEnabled()
        })

        expect(isEnabled).toBe(true)
        expect(mockGetItem).toHaveBeenCalledWith(BIOMETRIC_STORAGE_KEY)
    })

    test('checkBiometricsEnabled returns false when no biometric data', async () => {
        mockGetItem.mockResolvedValue(null)

        const { result } = await renderAndSettle()

        let isEnabled: boolean = true
        await act(async () => {
            isEnabled = await result.current.checkBiometricsEnabled()
        })

        expect(isEnabled).toBe(false)
        expect(mockGetItem).toHaveBeenCalledWith(BIOMETRIC_STORAGE_KEY)
    })

    test('checkBiometricsAvailable returns true when available', async () => {
        mockCheckBiometricsAvailable.mockResolvedValue(true)

        const { result } = await renderAndSettle()

        let isAvailable: boolean = false
        await act(async () => {
            isAvailable = await result.current.checkBiometricsAvailable()
        })

        expect(isAvailable).toBe(true)
        expect(mockCheckBiometricsAvailable).toHaveBeenCalled()
    })

    test('checkBiometricsAvailable returns false when not available', async () => {
        mockCheckBiometricsAvailable.mockResolvedValue(false)

        const { result } = await renderAndSettle()

        let isAvailable: boolean = true
        await act(async () => {
            isAvailable = await result.current.checkBiometricsAvailable()
        })

        expect(isAvailable).toBe(false)
        expect(mockCheckBiometricsAvailable).toHaveBeenCalled()
    })

    test('setBiometricsCode stores biometric code and sets isEnabled', async () => {
        const { result } = await renderAndSettle()

        expect(result.current.isEnabled).toBe(false)

        const code = new TextEncoder().encode('123456')

        await act(async () => {
            await result.current.setBiometricsCode(code)
        })

        expect(mockSetItem).toHaveBeenCalledWith(BIOMETRIC_STORAGE_KEY, code)
        expect(result.current.isEnabled).toBe(true)
    })

    test('enableBiometrics returns false when PIN is not enabled', async () => {
        mockGetItem.mockResolvedValue(null)

        const { result } = await renderAndSettle()

        let success: boolean = true
        await act(async () => {
            success = await result.current.enableBiometrics()
        })

        expect(success).toBe(false)
        expect(mockGetItem).toHaveBeenCalledWith(PIN_STORAGE_KEY)
        expect(result.current.isEnabled).toBe(false)
    })

    test('enableBiometrics returns false when PIN data not found', async () => {
        mockGetItem.mockResolvedValue(null)

        const { result } = await renderAndSettle()

        let success: boolean = true
        await act(async () => {
            success = await result.current.enableBiometrics()
        })

        expect(success).toBe(false)
        expect(mockGetItem).toHaveBeenCalledWith(PIN_STORAGE_KEY)
    })

    test('enableBiometrics successfully copies PIN to biometric storage and sets isEnabled', async () => {
        const pinData = new TextEncoder().encode('123456')
        mockGetItem.mockResolvedValue(pinData)
        mockCheckBiometricsAvailable.mockResolvedValue(true)
        mockAuthenticate.mockResolvedValue(true)

        const { result } = await renderAndSettle()

        let success: boolean = false
        await act(async () => {
            success = await result.current.enableBiometrics()
        })

        expect(success).toBe(true)
        expect(mockGetItem).toHaveBeenCalledWith(PIN_STORAGE_KEY)
        expect(mockCheckBiometricsAvailable).toHaveBeenCalled()
        expect(mockAuthenticate).toHaveBeenCalled()
        expect(mockSetItem).toHaveBeenCalledWith(BIOMETRIC_STORAGE_KEY, pinData)
        expect(result.current.isEnabled).toBe(true)
    })

    test('enableBiometrics returns false on error', async () => {
        const pinData = new TextEncoder().encode('123456')
        mockGetItem.mockResolvedValue(pinData)
        mockCheckBiometricsAvailable.mockResolvedValue(true)
        mockAuthenticate.mockRejectedValue(new Error('Auth error'))

        const { result } = await renderAndSettle()

        let success: boolean = true
        await act(async () => {
            success = await result.current.enableBiometrics()
        })

        expect(success).toBe(false)
    })

    test('disableBiometrics removes biometric data and sets isEnabled to false', async () => {
        const biometricData = new TextEncoder().encode('123456')
        mockGetItem.mockResolvedValue(biometricData)
        mockCheckBiometricsAvailable.mockResolvedValue(true)
        mockAuthenticate.mockResolvedValue(true)

        const { result } = await renderAndSettle()

        await act(async () => {
            await result.current.enableBiometrics()
        })

        expect(result.current.isEnabled).toBe(true)

        await act(async () => {
            await result.current.disableBiometrics()
        })

        expect(mockRemoveItem).toHaveBeenCalledWith(BIOMETRIC_STORAGE_KEY)
        expect(result.current.isEnabled).toBe(false)
    })

    test('authenticateWithBiometrics returns false when biometrics not enabled', async () => {
        mockGetItem.mockResolvedValue(null)

        const { result } = await renderAndSettle()

        let authenticated: boolean = true
        await act(async () => {
            authenticated = await result.current.authenticateWithBiometrics()
        })

        expect(authenticated).toBe(false)
        expect(mockAuthenticate).not.toHaveBeenCalled()
    })

    test('authenticateWithBiometrics returns true when biometrics enabled and auth succeeds', async () => {
        const biometricData = new TextEncoder().encode('123456')
        mockGetItem.mockResolvedValue(biometricData)
        mockAuthenticate.mockResolvedValue(true)

        const { result } = await renderAndSettle()

        let authenticated: boolean = false
        await act(async () => {
            authenticated = await result.current.authenticateWithBiometrics()
        })

        expect(authenticated).toBe(true)
        expect(mockAuthenticate).toHaveBeenCalled()
    })

    test('authenticateWithBiometrics returns false when biometric data missing', async () => {
        mockGetItem.mockResolvedValue(null)
        mockAuthenticate.mockResolvedValue(true)

        const { result } = await renderAndSettle()

        let authenticated: boolean = true
        await act(async () => {
            authenticated = await result.current.authenticateWithBiometrics()
        })

        expect(authenticated).toBe(false)
        expect(mockAuthenticate).not.toHaveBeenCalled()
    })

    test('authenticateWithBiometrics returns false when biometrics auth fails', async () => {
        const biometricData = new TextEncoder().encode('123456')
        mockGetItem.mockResolvedValue(biometricData)
        mockAuthenticate.mockResolvedValue(false)

        const { result } = await renderAndSettle()

        let authenticated: boolean = true
        await act(async () => {
            authenticated = await result.current.authenticateWithBiometrics()
        })

        expect(authenticated).toBe(false)
    })

    test('authenticateWithBiometrics returns false on error', async () => {
        const biometricData = new TextEncoder().encode('123456')
        mockGetItem.mockResolvedValue(biometricData)
        mockAuthenticate.mockRejectedValue(new Error('Auth error'))

        const { result } = await renderAndSettle()

        let authenticated: boolean = true
        await act(async () => {
            authenticated = await result.current.authenticateWithBiometrics()
        })

        expect(authenticated).toBe(false)
    })
})

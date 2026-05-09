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

const kmsMocks = vi.hoisted(() => ({
    pinBytes: null as Uint8Array | null,
    biometricBytes: null as Uint8Array | null,
    commitTypedSecret: vi.fn(),
    withTypedSecret: vi.fn(),
    hasTypedSecret: vi.fn(),
    removeTypedSecret: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-kms', () => ({
    useKMSService: () => ({
        commitTypedSecret: kmsMocks.commitTypedSecret,
        withTypedSecret: kmsMocks.withTypedSecret,
        hasTypedSecret: kmsMocks.hasTypedSecret,
        removeTypedSecret: kmsMocks.removeTypedSecret,
    }),
}))

const mockCheckBiometricsAvailable = vi.fn()
const mockAuthenticate = vi.fn()

const mockBiometricsService = {
    checkBiometricsAvailable: mockCheckBiometricsAvailable,
    authenticate: mockAuthenticate,
    getSupportedBiometricType: vi.fn(),
}

vi.mock('@perawallet/wallet-extension-provider', () => ({
    getProvider: () => ({
        biometrics: mockBiometricsService,
    }),
}))

import { useBiometrics } from '../useBiometrics'
import {
    PIN_RECORD_KEY_ID,
    BIOMETRIC_BLOB_KEY_ID,
    BIOMETRIC_BLOB_KEYSTORE_TYPE,
} from '../../constants'

const wireBlobMocks = () => {
    kmsMocks.commitTypedSecret.mockImplementation(
        async ({ id, bytes }: { id: string; bytes: Uint8Array }) => {
            if (id === PIN_RECORD_KEY_ID) kmsMocks.pinBytes = bytes
            else kmsMocks.biometricBytes = bytes
        },
    )
    kmsMocks.withTypedSecret.mockImplementation(
        async (id: string, handler: (bytes: Uint8Array) => unknown) => {
            const bytes =
                id === PIN_RECORD_KEY_ID
                    ? kmsMocks.pinBytes
                    : kmsMocks.biometricBytes
            if (!bytes) return null
            try {
                return await handler(bytes)
            } finally {
                bytes.fill(0)
            }
        },
    )
    kmsMocks.hasTypedSecret.mockImplementation((id: string) =>
        id === PIN_RECORD_KEY_ID
            ? kmsMocks.pinBytes !== null
            : kmsMocks.biometricBytes !== null,
    )
    kmsMocks.removeTypedSecret.mockImplementation(async (id: string) => {
        if (id === PIN_RECORD_KEY_ID) kmsMocks.pinBytes = null
        else kmsMocks.biometricBytes = null
    })
}

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
        kmsMocks.pinBytes = null
        kmsMocks.biometricBytes = null
        wireBlobMocks()
        mockCheckBiometricsAvailable.mockResolvedValue(false)
    })

    test('initializes isEnabled from secure storage on mount', async () => {
        kmsMocks.biometricBytes = new TextEncoder().encode('123456')

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
        kmsMocks.biometricBytes = new TextEncoder().encode('123456')

        const { result } = await renderAndSettle()

        let isEnabled: boolean = false
        await act(async () => {
            isEnabled = await result.current.checkBiometricsEnabled()
        })

        expect(isEnabled).toBe(true)
        expect(kmsMocks.hasTypedSecret).toHaveBeenCalledWith(
            BIOMETRIC_BLOB_KEY_ID,
        )
    })

    test('checkBiometricsEnabled returns false when no biometric data', async () => {
        const { result } = await renderAndSettle()

        let isEnabled: boolean = true
        await act(async () => {
            isEnabled = await result.current.checkBiometricsEnabled()
        })

        expect(isEnabled).toBe(false)
        expect(kmsMocks.hasTypedSecret).toHaveBeenCalledWith(
            BIOMETRIC_BLOB_KEY_ID,
        )
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

    test('refreshBiometricsBinding is a no-op when biometrics are not enabled', async () => {
        wireBlobMocks()
        // PIN exists but biometrics aren't enabled yet.
        kmsMocks.pinBytes = new Uint8Array([1, 2, 3])

        const { result } = await renderAndSettle()

        await act(async () => {
            await result.current.refreshBiometricsBinding()
        })

        // Should not have written anything to the biometric blob.
        expect(kmsMocks.commitTypedSecret).not.toHaveBeenCalled()
        expect(kmsMocks.biometricBytes).toBeNull()
    })

    test('refreshBiometricsBinding copies the current PIN_RECORD bytes to the biometric blob', async () => {
        wireBlobMocks()
        const pinRecordBytes = new Uint8Array([10, 20, 30, 40])
        kmsMocks.pinBytes = pinRecordBytes
        // Pretend biometrics are already enabled by seeding the blob.
        kmsMocks.biometricBytes = new Uint8Array([99])

        const { result } = await renderAndSettle()

        await act(async () => {
            await result.current.refreshBiometricsBinding()
        })

        expect(kmsMocks.commitTypedSecret).toHaveBeenCalledWith({
            id: BIOMETRIC_BLOB_KEY_ID,
            type: BIOMETRIC_BLOB_KEYSTORE_TYPE,
            bytes: pinRecordBytes,
        })
    })

    test('enableBiometrics returns false when PIN is not enabled', async () => {
        const { result } = await renderAndSettle()

        let success: boolean = true
        await act(async () => {
            success = await result.current.enableBiometrics()
        })

        expect(success).toBe(false)
        expect(kmsMocks.withTypedSecret).toHaveBeenCalledWith(
            PIN_RECORD_KEY_ID,
            expect.any(Function),
        )
        expect(result.current.isEnabled).toBe(false)
    })

    test('enableBiometrics returns false when PIN data not found', async () => {
        const { result } = await renderAndSettle()

        let success: boolean = true
        await act(async () => {
            success = await result.current.enableBiometrics()
        })

        expect(success).toBe(false)
        expect(kmsMocks.withTypedSecret).toHaveBeenCalledWith(
            PIN_RECORD_KEY_ID,
            expect.any(Function),
        )
    })

    test('enableBiometrics successfully copies PIN to biometric storage and sets isEnabled', async () => {
        const pinData = new TextEncoder().encode('123456')
        kmsMocks.pinBytes = pinData
        mockCheckBiometricsAvailable.mockResolvedValue(true)
        mockAuthenticate.mockResolvedValue(true)

        const { result } = await renderAndSettle()

        let success: boolean = false
        await act(async () => {
            success = await result.current.enableBiometrics()
        })

        expect(success).toBe(true)
        expect(kmsMocks.withTypedSecret).toHaveBeenCalledWith(
            PIN_RECORD_KEY_ID,
            expect.any(Function),
        )
        expect(mockCheckBiometricsAvailable).toHaveBeenCalled()
        expect(mockAuthenticate).toHaveBeenCalled()
        expect(kmsMocks.commitTypedSecret).toHaveBeenCalledWith({
            id: BIOMETRIC_BLOB_KEY_ID,
            type: BIOMETRIC_BLOB_KEYSTORE_TYPE,
            bytes: pinData,
        })
        expect(result.current.isEnabled).toBe(true)
    })

    test('enableBiometrics returns false on error', async () => {
        kmsMocks.pinBytes = new TextEncoder().encode('123456')
        mockCheckBiometricsAvailable.mockResolvedValue(true)
        mockAuthenticate.mockRejectedValue(new Error('Auth error'))

        const { result } = await renderAndSettle()

        let success: boolean = true
        await act(async () => {
            success = await result.current.enableBiometrics()
        })

        expect(success).toBe(false)
    })

    test('enableBiometrics returns false when biometrics are not available', async () => {
        kmsMocks.pinBytes = new TextEncoder().encode('123456')
        mockCheckBiometricsAvailable.mockResolvedValue(false)

        const { result } = await renderAndSettle()

        let success: boolean = true
        await act(async () => {
            success = await result.current.enableBiometrics()
        })

        expect(success).toBe(false)
        expect(mockAuthenticate).not.toHaveBeenCalled()
    })

    test('enableBiometrics returns false when the user declines authentication', async () => {
        kmsMocks.pinBytes = new TextEncoder().encode('123456')
        mockCheckBiometricsAvailable.mockResolvedValue(true)
        mockAuthenticate.mockResolvedValue(false)

        const { result } = await renderAndSettle()

        let success: boolean = true
        await act(async () => {
            success = await result.current.enableBiometrics()
        })

        expect(success).toBe(false)
        // The biometric blob must not be committed when auth fails.
        const commits = kmsMocks.commitTypedSecret.mock.calls.filter(
            call => call[0].id === BIOMETRIC_BLOB_KEY_ID,
        )
        expect(commits).toHaveLength(0)
    })

    test('disableBiometrics removes biometric data and sets isEnabled to false', async () => {
        kmsMocks.pinBytes = new TextEncoder().encode('123456')
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

        expect(kmsMocks.removeTypedSecret).toHaveBeenCalledWith(
            BIOMETRIC_BLOB_KEY_ID,
        )
        expect(result.current.isEnabled).toBe(false)
    })

    test('authenticateWithBiometrics returns false when biometrics not enabled', async () => {
        const { result } = await renderAndSettle()

        let authenticated: boolean = true
        await act(async () => {
            authenticated = await result.current.authenticateWithBiometrics()
        })

        expect(authenticated).toBe(false)
        expect(mockAuthenticate).not.toHaveBeenCalled()
    })

    test('authenticateWithBiometrics returns true when biometrics enabled and auth succeeds', async () => {
        kmsMocks.biometricBytes = new TextEncoder().encode('123456')
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
        kmsMocks.biometricBytes = new TextEncoder().encode('123456')
        mockAuthenticate.mockResolvedValue(false)

        const { result } = await renderAndSettle()

        let authenticated: boolean = true
        await act(async () => {
            authenticated = await result.current.authenticateWithBiometrics()
        })

        expect(authenticated).toBe(false)
    })

    test('authenticateWithBiometrics returns false on error', async () => {
        kmsMocks.biometricBytes = new TextEncoder().encode('123456')
        mockAuthenticate.mockRejectedValue(new Error('Auth error'))

        const { result } = await renderAndSettle()

        let authenticated: boolean = true
        await act(async () => {
            authenticated = await result.current.authenticateWithBiometrics()
        })

        expect(authenticated).toBe(false)
    })
})

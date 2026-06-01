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
import { renderHook, waitFor } from '@testing-library/react'

const mockGetSecurityLevel = vi.fn()

vi.mock('@perawallet/wallet-extension-provider', () => ({
    getProvider: () => ({
        biometrics: { getSecurityLevel: mockGetSecurityLevel },
    }),
}))

vi.mock('@perawallet/wallet-core-shared', () => ({
    logger: { warn: vi.fn(), error: vi.fn() },
}))

import {
    getBiometricSecurityLevel,
    hasStrongBiometricOrCredential,
    useBiometricSecurityLevel,
} from '../useBiometricSecurityLevel'

describe('hasStrongBiometricOrCredential', () => {
    test('accepts strong, weak, and secret levels', () => {
        expect(hasStrongBiometricOrCredential('strong')).toBe(true)
        expect(hasStrongBiometricOrCredential('weak')).toBe(true)
        expect(hasStrongBiometricOrCredential('secret')).toBe(true)
    })

    test('rejects only the none level', () => {
        expect(hasStrongBiometricOrCredential('none')).toBe(false)
    })
})

describe('getBiometricSecurityLevel', () => {
    beforeEach(() => mockGetSecurityLevel.mockReset())

    test('returns the level reported by the platform service', async () => {
        mockGetSecurityLevel.mockResolvedValue('weak')
        expect(await getBiometricSecurityLevel()).toBe('weak')
    })
})

describe('useBiometricSecurityLevel', () => {
    beforeEach(() => mockGetSecurityLevel.mockReset())

    test('reports hasStrongBiometric=true only for a strong level', async () => {
        mockGetSecurityLevel.mockResolvedValue('strong')
        const { result } = renderHook(() => useBiometricSecurityLevel())

        await waitFor(() => expect(result.current.isLoading).toBe(false))
        expect(result.current.securityLevel).toBe('strong')
        expect(result.current.hasStrongBiometric).toBe(true)
    })

    test('reports hasStrongBiometric=false for a weak level', async () => {
        mockGetSecurityLevel.mockResolvedValue('weak')
        const { result } = renderHook(() => useBiometricSecurityLevel())

        await waitFor(() => expect(result.current.isLoading).toBe(false))
        expect(result.current.securityLevel).toBe('weak')
        expect(result.current.hasStrongBiometric).toBe(false)
    })

    test('reports hasStrongBiometricOrCredential=true for a device-credential (secret) level', async () => {
        mockGetSecurityLevel.mockResolvedValue('secret')
        const { result } = renderHook(() => useBiometricSecurityLevel())

        await waitFor(() => expect(result.current.isLoading).toBe(false))
        expect(result.current.hasStrongBiometric).toBe(false)
        expect(result.current.hasStrongBiometricOrCredential).toBe(true)
    })
})

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

import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { resetProvider, getProvider } from '@perawallet/wallet-core-shared'
import { buildTestPlatform } from '@perawallet/wallet-extension-platform'

const testPlatform = buildTestPlatform()

vi.mock('@perawallet/wallet-extension-platform-driver', () => ({
    WithPlatformExtension: () => ({
        ...testPlatform,
        initialize: vi.fn().mockResolvedValue({
            token: 'test-token',
            unsubscribe: vi.fn(),
        }),
    }),
}))

import { PeraWalletProvider, usePeraProvider } from '../context'
import type { PeraProvider } from '../pera-provider'

describe('PeraWalletProvider', () => {
    afterEach(() => {
        resetProvider()
    })

    it('should create the provider and set the module singleton', () => {
        renderHook(() => usePeraProvider(), {
            wrapper: ({ children }) => (
                <PeraWalletProvider>{children}</PeraWalletProvider>
            ),
        })

        expect(() => getProvider()).not.toThrow()
    })

    it('should expose all platform services via usePeraProvider', async () => {
        const { result } = renderHook(() => usePeraProvider(), {
            wrapper: ({ children }) => (
                <PeraWalletProvider>{children}</PeraWalletProvider>
            ),
        })

        await waitFor(() => {
            expect(result.current).not.toBeNull()
        })

        expect(result.current.analytics).toBe(testPlatform.analytics)
        expect(result.current.keyValueStorage).toBe(
            testPlatform.keyValueStorage,
        )
        expect(result.current.secureStorage).toBe(testPlatform.secureStorage)
        expect(result.current.remoteConfig).toBe(testPlatform.remoteConfig)
        expect(result.current.pushNotification).toBe(
            testPlatform.pushNotification,
        )
        expect(result.current.crashReporting).toBe(testPlatform.crashReporting)
        expect(result.current.deviceInfo).toBe(testPlatform.deviceInfo)
        expect(result.current.biometrics).toBe(testPlatform.biometrics)
    })

    it('should expose all platform services via getProvider for non-React code', async () => {
        const { result } = renderHook(() => usePeraProvider(), {
            wrapper: ({ children }) => (
                <PeraWalletProvider>{children}</PeraWalletProvider>
            ),
        })

        await waitFor(() => {
            expect(result.current).not.toBeNull()
        })

        const provider = getProvider<PeraProvider>()
        expect(provider.analytics).toBe(testPlatform.analytics)
        expect(provider.keyValueStorage).toBe(testPlatform.keyValueStorage)
        expect(provider.secureStorage).toBe(testPlatform.secureStorage)
        expect(provider.remoteConfig).toBe(testPlatform.remoteConfig)
        expect(provider.pushNotification).toBe(testPlatform.pushNotification)
        expect(provider.crashReporting).toBe(testPlatform.crashReporting)
        expect(provider.deviceInfo).toBe(testPlatform.deviceInfo)
        expect(provider.biometrics).toBe(testPlatform.biometrics)
    })

    it('should return the same instance from both usePeraProvider and getProvider', async () => {
        const { result } = renderHook(() => usePeraProvider(), {
            wrapper: ({ children }) => (
                <PeraWalletProvider>{children}</PeraWalletProvider>
            ),
        })

        await waitFor(() => {
            expect(result.current).not.toBeNull()
        })

        const singletonProvider = getProvider<PeraProvider>()
        expect(result.current).toBe(singletonProvider)
    })
})

describe('usePeraProvider', () => {
    it('should throw when used outside of PeraWalletProvider', () => {
        expect(() => renderHook(() => usePeraProvider())).toThrow(
            'usePeraProvider must be used within a PeraWalletProvider',
        )
    })
})

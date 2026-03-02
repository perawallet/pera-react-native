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
import { afterEach, describe, expect, it } from 'vitest'
import { renderHook } from '@testing-library/react'
import { resetProvider, getProvider } from '@perawallet/wallet-core-provider'
import { PeraWalletProvider, usePeraProvider } from '../context'
import type { PeraProvider } from '../pera-provider'
import { buildTestPlatform } from '../test-utils'

describe('PeraWalletProvider', () => {
    afterEach(() => {
        resetProvider()
    })

    it('should create the provider and set the module singleton', () => {
        const platform = buildTestPlatform()

        renderHook(() => usePeraProvider(), {
            wrapper: ({ children }) => (
                <PeraWalletProvider platform={platform}>
                    {children}
                </PeraWalletProvider>
            ),
        })

        expect(() => getProvider()).not.toThrow()
    })

    it('should expose all platform services via usePeraProvider', () => {
        const platform = buildTestPlatform()

        const { result } = renderHook(() => usePeraProvider(), {
            wrapper: ({ children }) => (
                <PeraWalletProvider platform={platform}>
                    {children}
                </PeraWalletProvider>
            ),
        })

        expect(result.current.analytics).toBe(platform.analytics)
        expect(result.current.keyValueStorage).toBe(platform.keyValueStorage)
        expect(result.current.secureStorage).toBe(platform.secureStorage)
        expect(result.current.remoteConfig).toBe(platform.remoteConfig)
        expect(result.current.pushNotification).toBe(platform.pushNotification)
        expect(result.current.crashReporting).toBe(platform.crashReporting)
        expect(result.current.deviceInfo).toBe(platform.deviceInfo)
        expect(result.current.biometrics).toBe(platform.biometrics)
    })

    it('should expose all platform services via getProvider for non-React code', () => {
        const platform = buildTestPlatform()

        renderHook(() => usePeraProvider(), {
            wrapper: ({ children }) => (
                <PeraWalletProvider platform={platform}>
                    {children}
                </PeraWalletProvider>
            ),
        })

        const provider = getProvider<PeraProvider>()
        expect(provider.analytics).toBe(platform.analytics)
        expect(provider.keyValueStorage).toBe(platform.keyValueStorage)
        expect(provider.secureStorage).toBe(platform.secureStorage)
        expect(provider.remoteConfig).toBe(platform.remoteConfig)
        expect(provider.pushNotification).toBe(platform.pushNotification)
        expect(provider.crashReporting).toBe(platform.crashReporting)
        expect(provider.deviceInfo).toBe(platform.deviceInfo)
        expect(provider.biometrics).toBe(platform.biometrics)
    })

    it('should return the same instance from both usePeraProvider and getProvider', () => {
        const platform = buildTestPlatform()

        const { result } = renderHook(() => usePeraProvider(), {
            wrapper: ({ children }) => (
                <PeraWalletProvider platform={platform}>
                    {children}
                </PeraWalletProvider>
            ),
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

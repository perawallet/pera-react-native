/*
 Copyright 2022-2026 Pera Wallet, LDA
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
import { describe, expect, it } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { getProvider } from '../singleton'

vi.mock('react-native-quick-crypto', () => ({ subtle: {} }))

vi.mock('@algorandfoundation/react-native-keystore', () => ({
    WithKeyStore: () => ({
        key: { store: {} },
    }),
    createReactNativeKeyStore: () => ({ ready: Promise.resolve() }),
    decode: vi.fn(),
    storage: { getAllKeys: () => [], getString: vi.fn() },
}))

vi.mock('@perawallet/wallet-extension-ledger-react-native', () => ({
    WithLedgerExtension: () => ({}),
}))

vi.mock('@perawallet/wallet-extension-ledger-react-native-usb', () => ({
    WithLedgerUsbExtension: () => ({}),
}))

vi.mock('@tanstack/store', () => ({
    Store: class MockStore {
        constructor() {}
    },
}))

vi.mock('before-after-hook', () => ({
    default: {
        Collection: class MockCollection {
            constructor() {}
        },
    },
}))

import { PeraWalletProvider, usePeraProvider } from '../context'

describe('PeraWalletProvider', () => {
    it('should create the provider and set the module singleton', () => {
        renderHook(() => usePeraProvider(), {
            wrapper: ({ children }) => (
                <PeraWalletProvider>{children}</PeraWalletProvider>
            ),
        })

        expect(() => getProvider()).not.toThrow()
    })

    it('should expose all platform services via usePeraProvider', async () => {
        const provider = getProvider()
        const { result } = renderHook(() => usePeraProvider(), {
            wrapper: ({ children }) => (
                <PeraWalletProvider>{children}</PeraWalletProvider>
            ),
        })

        await waitFor(() => {
            expect(result.current).not.toBeNull()
        })

        expect(result.current.analytics).toBe(provider.analytics)
        expect(result.current.keyValueStorage).toBe(provider.keyValueStorage)
        expect(result.current.remoteConfig).toBe(provider.remoteConfig)
        expect(result.current.pushNotification).toBe(provider.pushNotification)
        expect(result.current.crashReporting).toBe(provider.crashReporting)
        expect(result.current.deviceInfo).toBe(provider.deviceInfo)
        expect(result.current.biometrics).toBe(provider.biometrics)
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

        const singletonProvider = getProvider()
        expect(result.current).toBe(singletonProvider)
    })

    it('preserves the cached providerRef across re-renders (does not re-resolve the singleton)', () => {
        const { result, rerender } = renderHook(() => usePeraProvider(), {
            wrapper: ({ children }) => (
                <PeraWalletProvider>{children}</PeraWalletProvider>
            ),
        })

        const first = result.current
        rerender()
        rerender()
        // Same instance — covers the `providerRef.current !== null` branch
        // on subsequent renders.
        expect(result.current).toBe(first)
    })
})

describe('usePeraProvider', () => {
    it('should throw when used outside of PeraWalletProvider', () => {
        expect(() => renderHook(() => usePeraProvider())).toThrow(
            'usePeraProvider must be used within a PeraWalletProvider',
        )
    })
})

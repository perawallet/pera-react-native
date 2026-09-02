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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import * as SplashScreen from 'expo-splash-screen'
import { useAppBootstrap } from '../useAppBootstrap'

const mocks = vi.hoisted(() => {
    // Mirrors the provider's class so `instanceof` works against the mocked
    // module.
    class KeystoreHydrationError extends Error {
        readonly failedIds: string[]
        constructor(failedIds: string[]) {
            super('keystore hydration failed')
            this.name = 'KeystoreHydrationError'
            this.failedIds = failedIds
        }
    }
    const provider = {
        initialize: vi.fn(),
        database: {},
        keyValueStorage: {},
        crashReporting: {},
        deviceInfo: {
            getAppName: () => 'Pera',
            getAppPackage: () => 'com.pera',
            getAppVersion: () => '1.0.0',
            getDevicePlatform: () => 'ios',
            getDeviceLocale: () => 'en',
            getDeviceOSVersion: () => '17',
            getDeviceModelId: () => 'iPhone',
            getUserAgent: () => 'ua',
        },
    }
    return {
        provider,
        KeystoreHydrationError,
        hydrateKeystore: vi.fn(),
        getProvider: vi.fn(() => provider),
        initializeDatabase: vi.fn(),
        getDatabase: vi.fn(() => ({})),
        seedAlgoAsset: vi.fn(),
        initializeSyncService: vi.fn(),
        setOnConfirmedHandler: vi.fn(),
        createAsyncStoragePersister: vi.fn(() => ({ persistClient: vi.fn() })),
        runPasskeyAutofillBootstrap: vi.fn(),
        loggerError: vi.fn(),
    }
})

vi.mock('@perawallet/wallet-extension-provider', () => ({
    usePeraProvider: () => mocks.provider,
    hydrateKeystore: mocks.hydrateKeystore,
    getProvider: mocks.getProvider,
    KeystoreHydrationError: mocks.KeystoreHydrationError,
}))

vi.mock('@perawallet/wallet-core-database', () => ({
    initializeDatabase: mocks.initializeDatabase,
    getDatabase: mocks.getDatabase,
}))

vi.mock('@perawallet/wallet-core-assets', () => ({
    seedAlgoAsset: mocks.seedAlgoAsset,
}))

vi.mock('@perawallet/wallet-core-background', () => ({
    initializeSyncService: mocks.initializeSyncService,
}))

vi.mock('@perawallet/wallet-core-signing', () => ({
    setOnConfirmedHandler: mocks.setOnConfirmedHandler,
}))

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    algorandSafeQuerySerialize: (value: unknown) => value,
    algorandSafeQueryParse: (value: unknown) => value,
}))

vi.mock('@tanstack/query-async-storage-persister', () => ({
    createAsyncStoragePersister: mocks.createAsyncStoragePersister,
}))

vi.mock('expo-splash-screen', () => ({
    hideAsync: vi.fn(),
    preventAutoHideAsync: vi.fn(),
}))

vi.mock('./providers/QueryProvider', () => ({
    queryClient: {},
}))

vi.mock('../providers/QueryProvider', () => ({
    queryClient: {},
}))

vi.mock('./bootstrap/passkey-autofill', () => ({
    runPasskeyAutofillBootstrap: mocks.runPasskeyAutofillBootstrap,
}))

vi.mock('../bootstrap/passkey-autofill', () => ({
    runPasskeyAutofillBootstrap: mocks.runPasskeyAutofillBootstrap,
}))

vi.mock('@perawallet/wallet-core-shared', () => ({
    logger: {
        error: mocks.loggerError,
        warn: vi.fn(),
        debug: vi.fn(),
        info: vi.fn(),
    },
    updateBackendHeaders: vi.fn(),
}))

describe('useAppBootstrap', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.useRealTimers()
        mocks.provider.initialize.mockResolvedValue({ token: 'fcm-token' })
        mocks.hydrateKeystore.mockResolvedValue(undefined)
        mocks.initializeDatabase.mockResolvedValue(undefined)
        mocks.seedAlgoAsset.mockResolvedValue(undefined)
        mocks.runPasskeyAutofillBootstrap.mockResolvedValue(undefined)
    })

    it('bootstraps successfully: bootstrapped true, initError false, persister set, splash hidden', async () => {
        vi.useFakeTimers()
        const { result } = renderHook(() => useAppBootstrap())

        await act(async () => {
            await vi.runAllTimersAsync()
        })

        expect(result.current.bootstrapped).toBe(true)
        expect(result.current.initError).toBeNull()
        expect(result.current.persister).toBeDefined()
        expect(SplashScreen.hideAsync).toHaveBeenCalledTimes(1)
    })

    it('sets initError and hides splash when provider.initialize() rejects', async () => {
        mocks.provider.initialize.mockRejectedValue(new Error('boom'))
        vi.useFakeTimers()
        const { result } = renderHook(() => useAppBootstrap())

        await act(async () => {
            await vi.runAllTimersAsync()
        })

        expect(result.current.bootstrapped).toBe(false)
        expect(result.current.initError).toBe('generic')
        expect(SplashScreen.hideAsync).toHaveBeenCalledTimes(1)
    })

    it('sets initError when database initialization rejects', async () => {
        mocks.initializeDatabase.mockRejectedValue(new Error('db down'))
        vi.useFakeTimers()
        const { result } = renderHook(() => useAppBootstrap())

        await act(async () => {
            await vi.runAllTimersAsync()
        })

        expect(result.current.bootstrapped).toBe(false)
        expect(result.current.initError).toBe('generic')
        expect(SplashScreen.hideAsync).toHaveBeenCalledTimes(1)
    })

    // A record hydration cannot decode fails it on every launch, so "try
    // again" copy is a dead end — the UI needs to know this failure is a
    // data-integrity one.
    it('reports a keystore initError when hydration fails on undecodable records', async () => {
        mocks.hydrateKeystore.mockRejectedValue(
            new mocks.KeystoreHydrationError(['bad-record']),
        )
        vi.useFakeTimers()
        const { result } = renderHook(() => useAppBootstrap())

        await act(async () => {
            await vi.runAllTimersAsync()
        })

        expect(result.current.bootstrapped).toBe(false)
        expect(result.current.initError).toBe('keystore')
        expect(SplashScreen.hideAsync).toHaveBeenCalledTimes(1)
    })

    it('tolerates token undefined from initialize (fcmToken null, no error)', async () => {
        mocks.provider.initialize.mockResolvedValue({ token: undefined })
        vi.useFakeTimers()
        const { result } = renderHook(() => useAppBootstrap())

        await act(async () => {
            await vi.runAllTimersAsync()
        })

        expect(result.current.bootstrapped).toBe(true)
        expect(result.current.initError).toBeNull()
        expect(result.current.fcmToken).toBeNull()
    })

    it('retryBootstrap clears initError and re-runs bootstrap to success', async () => {
        mocks.provider.initialize
            .mockRejectedValueOnce(new Error('first attempt fails'))
            .mockResolvedValue({ token: 'fcm-token' })
        vi.useFakeTimers()
        const { result } = renderHook(() => useAppBootstrap())

        await act(async () => {
            await vi.runAllTimersAsync()
        })

        expect(result.current.initError).toBe('generic')
        expect(result.current.bootstrapped).toBe(false)

        await act(async () => {
            result.current.retryBootstrap()
        })
        await act(async () => {
            await vi.runAllTimersAsync()
        })

        expect(result.current.initError).toBeNull()
        expect(result.current.bootstrapped).toBe(true)
    })
})

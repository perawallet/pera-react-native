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
        expect(result.current.initError).toBe(false)
        expect(result.current.persister).toBeDefined()
        expect(SplashScreen.hideAsync).toHaveBeenCalledTimes(1)
    })

    // rAF does not fire while the app produces no frames, so a cold start that
    // begins in the background must still reach hideAsync via the backstop
    // timer — otherwise the splash sits there until the user foregrounds the
    // app (PERA-4727).
    it('hides the splash via the backstop when no frames are produced', async () => {
        const rafSpy = vi
            .spyOn(globalThis, 'requestAnimationFrame')
            .mockImplementation(() => 0 as unknown as number)
        vi.useFakeTimers()

        renderHook(() => useAppBootstrap())
        await act(async () => {
            await vi.runAllTimersAsync()
        })

        expect(rafSpy).toHaveBeenCalled()
        expect(SplashScreen.hideAsync).toHaveBeenCalledTimes(1)
        rafSpy.mockRestore()
    })

    it('sets initError and hides splash when provider.initialize() rejects', async () => {
        mocks.provider.initialize.mockRejectedValue(new Error('boom'))
        vi.useFakeTimers()
        const { result } = renderHook(() => useAppBootstrap())

        await act(async () => {
            await vi.runAllTimersAsync()
        })

        expect(result.current.bootstrapped).toBe(false)
        expect(result.current.initError).toBe(true)
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
        expect(result.current.initError).toBe(true)
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
        expect(result.current.initError).toBe(false)
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

        expect(result.current.initError).toBe(true)
        expect(result.current.bootstrapped).toBe(false)

        await act(async () => {
            result.current.retryBootstrap()
        })
        await act(async () => {
            await vi.runAllTimersAsync()
        })

        expect(result.current.initError).toBe(false)
        expect(result.current.bootstrapped).toBe(true)
    })
})

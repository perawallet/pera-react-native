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
            getDeviceLocales: () => ['en-US'],
            getDeviceOSVersion: () => '17',
            getDeviceModelId: () => 'iPhone',
            getUserAgent: () => 'ua',
        },
        remoteConfig: {
            getBooleanValue: vi.fn(
                (_key: string, fallback?: boolean) => fallback ?? false,
            ),
            getStringValue: vi.fn(
                (_key: string, fallback?: string) => fallback ?? '',
            ),
        },
    }
    return {
        provider,
        keystoreReady: vi.fn(),
        runKeystoreMaintenance: vi.fn(),
        getProvider: vi.fn(() => provider),
        initializeDatabase: vi.fn(),
        getDatabase: vi.fn(() => ({})),
        seedAlgoAsset: vi.fn(),
        initializeSyncService: vi.fn(),
        setOnConfirmedHandler: vi.fn(),
        createAsyncStoragePersister: vi.fn(() => ({ persistClient: vi.fn() })),
        runPasskeyAutofillBootstrap: vi.fn(),
        loggerError: vi.fn(),
        configOverrides: {} as Record<string, string | boolean | number>,
        settingsState: { language: 'system' as string },
        settingsHasHydrated: vi.fn(() => true),
        settingsOnFinishHydration: vi.fn(
            (_fn: (state: unknown) => void) => () => {},
        ),
        i18nChangeLanguage: vi.fn().mockResolvedValue(undefined),
        i18nLanguage: 'en',
        accountsHasHydrated: vi.fn(() => true),
        accountsOnFinishHydration: vi.fn(
            (_fn: (state: unknown) => void) => () => {},
        ),
        applyLaunchAccountPreference: vi.fn(),
    }
})

vi.mock('@perawallet/wallet-extension-provider', () => ({
    usePeraProvider: () => mocks.provider,
    runKeystoreMaintenance: mocks.runKeystoreMaintenance,
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
    derivePQKeygenSeed: (entropy: Uint8Array) => entropy,
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

vi.mock('@perawallet/wallet-core-settings', () => ({
    useSettingsStore: {
        getState: () => mocks.settingsState,
        persist: {
            hasHydrated: mocks.settingsHasHydrated,
            onFinishHydration: mocks.settingsOnFinishHydration,
        },
    },
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useAccountsStore: {
        getState: () => ({
            applyLaunchAccountPreference: mocks.applyLaunchAccountPreference,
        }),
        persist: {
            hasHydrated: mocks.accountsHasHydrated,
            onFinishHydration: mocks.accountsOnFinishHydration,
        },
    },
}))

vi.mock('./i18n', () => ({
    default: {
        get language() {
            return mocks.i18nLanguage
        },
        changeLanguage: mocks.i18nChangeLanguage,
    },
}))
vi.mock('../i18n', () => ({
    default: {
        get language() {
            return mocks.i18nLanguage
        },
        changeLanguage: mocks.i18nChangeLanguage,
    },
}))

// The real `readRemoteConfigWithOverrides` is imported from its own module
// rather than stubbed: the whole point of item 2a is that bootstrap and the
// hook share one implementation, so a stub here would test nothing. The
// package barrel itself can't be `importActual`'d — it pulls the zustand
// store, which registers itself against the (mocked) shared logger.
vi.mock('@perawallet/wallet-core-remote-config', async () => {
    const { readRemoteConfigWithOverrides } =
        await import('../../../../packages/remote-config/src/utils/readRemoteConfigWithOverrides')
    return {
        RemoteConfigKeys: {
            enable_language_selection: 'enable_language_selection',
            active_locales: 'active_locales',
        },
        readRemoteConfigWithOverrides,
        useRemoteConfigStore: {
            getState: () => ({ configOverrides: mocks.configOverrides }),
        },
    }
})

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
        mocks.provider.initialize.mockResolvedValue({
            notifications: Promise.resolve({ token: 'fcm-token' }),
        })
        mocks.keystoreReady.mockResolvedValue(undefined)
        mocks.runKeystoreMaintenance.mockResolvedValue({
            repair: { repaired: 0, failed: 0 },
        })
        mocks.initializeDatabase.mockResolvedValue(undefined)
        mocks.seedAlgoAsset.mockResolvedValue(undefined)
        mocks.runPasskeyAutofillBootstrap.mockResolvedValue(undefined)
        mocks.configOverrides = {}
        mocks.settingsState.language = 'system'
        mocks.settingsHasHydrated.mockReturnValue(true)
        mocks.settingsOnFinishHydration.mockImplementation(() => () => {})
        mocks.i18nChangeLanguage.mockResolvedValue(undefined)
        mocks.i18nLanguage = 'en'
        mocks.provider.remoteConfig.getBooleanValue.mockImplementation(
            (_key: string, fallback?: boolean) => fallback ?? false,
        )
        mocks.provider.remoteConfig.getStringValue.mockImplementation(
            (_key: string, fallback?: string) => fallback ?? '',
        )
        mocks.provider.deviceInfo.getDeviceLocales = () => ['en-US']
        mocks.accountsHasHydrated.mockReturnValue(true)
        mocks.accountsOnFinishHydration.mockImplementation(() => () => {})
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

    // Sequencing the passes is the provider's job (see
    // extensions/provider's runKeystoreMaintenance spec); the app only has to
    // wait for it before declaring itself bootstrapped.
    test('waits for keystore maintenance before bootstrapping', async () => {
        vi.useFakeTimers()
        renderHook(() => useAppBootstrap())

        await act(async () => {
            await vi.runAllTimersAsync()
        })

        expect(mocks.runKeystoreMaintenance).toHaveBeenCalledTimes(1)
    })

    // An unreadable master key with records still on disk must not boot into
    // an empty wallet — that is what prompts a destructive re-onboard.
    it('fails bootstrap when keystore maintenance throws', async () => {
        mocks.runKeystoreMaintenance.mockRejectedValue(
            new Error('master key unreadable'),
        )
        vi.useFakeTimers()
        const { result } = renderHook(() => useAppBootstrap())

        await act(async () => {
            await vi.runAllTimersAsync()
        })

        expect(result.current.bootstrapped).toBe(false)
        expect(result.current.initError).toBe(true)
    })

    it('tolerates token undefined from initialize (fcmToken null, no error)', async () => {
        mocks.provider.initialize.mockResolvedValue({
            notifications: Promise.resolve({ token: undefined }),
        })
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
            .mockResolvedValue({
                notifications: Promise.resolve({ token: 'fcm-token' }),
            })
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

    it('forces English when language selection is disabled, even if a language was previously active', async () => {
        mocks.i18nLanguage = 'de'
        mocks.settingsState.language = 'de'
        mocks.provider.remoteConfig.getBooleanValue.mockReturnValue(false)
        vi.useFakeTimers()

        const { result } = renderHook(() => useAppBootstrap())
        await act(async () => {
            await vi.runAllTimersAsync()
        })

        expect(mocks.i18nChangeLanguage).toHaveBeenCalledWith('en')
        expect(result.current.bootstrapped).toBe(true)
    })

    it('applies a stored override that is still within the effective set once enabled', async () => {
        mocks.i18nLanguage = 'fr'
        mocks.settingsState.language = 'en'
        mocks.provider.remoteConfig.getBooleanValue.mockReturnValue(true)
        mocks.provider.remoteConfig.getStringValue.mockReturnValue('en')
        vi.useFakeTimers()

        renderHook(() => useAppBootstrap())
        await act(async () => {
            await vi.runAllTimersAsync()
        })

        expect(mocks.i18nChangeLanguage).toHaveBeenCalledWith('en')
    })

    it('does not call changeLanguage when the effective locale already matches', async () => {
        mocks.i18nLanguage = 'en'
        mocks.settingsState.language = 'system'
        mocks.provider.remoteConfig.getBooleanValue.mockReturnValue(false)
        vi.useFakeTimers()

        renderHook(() => useAppBootstrap())
        await act(async () => {
            await vi.runAllTimersAsync()
        })

        expect(mocks.i18nChangeLanguage).not.toHaveBeenCalled()
    })

    it('waits for settings hydration before resolving the effective locale', async () => {
        // 'fr' has no shipped bundle, so it can never be effective regardless
        // of active_locales — use 'en' as the override target and start
        // i18n on a different language so the eventual change is observable.
        mocks.i18nLanguage = 'fr'
        mocks.settingsState.language = 'en'
        mocks.provider.remoteConfig.getBooleanValue.mockReturnValue(true)
        mocks.provider.remoteConfig.getStringValue.mockReturnValue('en')
        mocks.settingsHasHydrated.mockReturnValue(false)
        let finishHydration: (() => void) | undefined
        mocks.settingsOnFinishHydration.mockImplementation(fn => {
            finishHydration = () => fn(mocks.settingsState)
            return () => {}
        })
        vi.useFakeTimers()

        const { result } = renderHook(() => useAppBootstrap())
        await act(async () => {
            await vi.advanceTimersByTimeAsync(10)
        })
        expect(result.current.bootstrapped).toBe(false)

        finishHydration?.()
        await act(async () => {
            await vi.runAllTimersAsync()
        })

        expect(mocks.i18nChangeLanguage).toHaveBeenCalledWith('en')
        expect(result.current.bootstrapped).toBe(true)
    })

    // zustand's persist never fires onFinishHydration when rehydration
    // rejects, so without the bounded wait this leaves the app on the splash
    // screen forever.
    it('bootstraps anyway when settings hydration never finishes', async () => {
        mocks.settingsHasHydrated.mockReturnValue(false)
        mocks.settingsOnFinishHydration.mockImplementation(() => () => {})
        vi.useFakeTimers()

        const { result } = renderHook(() => useAppBootstrap())
        await act(async () => {
            await vi.advanceTimersByTimeAsync(10)
        })
        expect(result.current.bootstrapped).toBe(false)

        await act(async () => {
            await vi.runAllTimersAsync()
        })

        expect(result.current.bootstrapped).toBe(true)
        expect(result.current.initError).toBe(false)
        expect(SplashScreen.hideAsync).toHaveBeenCalledTimes(1)
    })

    // A flag flipped in the dev Feature Flags screen has to survive the next
    // cold start — bootstrap reads the same override layer useRemoteConfig()
    // applies, not the raw service underneath it.
    it('honours dev remote-config overrides when resolving the locale', async () => {
        mocks.i18nLanguage = 'fr'
        mocks.settingsState.language = 'en'
        // Raw service says the feature is off; only the override turns it on.
        mocks.provider.remoteConfig.getBooleanValue.mockReturnValue(false)
        mocks.provider.remoteConfig.getStringValue.mockReturnValue('')
        mocks.configOverrides = {
            enable_language_selection: true,
            active_locales: 'en',
        }
        vi.useFakeTimers()

        renderHook(() => useAppBootstrap())
        await act(async () => {
            await vi.runAllTimersAsync()
        })

        expect(mocks.i18nChangeLanguage).toHaveBeenCalledWith('en')
        // The raw service was never consulted for the overridden keys.
        expect(
            mocks.provider.remoteConfig.getBooleanValue,
        ).not.toHaveBeenCalledWith('enable_language_selection', false)
        expect(
            mocks.provider.remoteConfig.getStringValue,
        ).not.toHaveBeenCalledWith('active_locales', '')
    })

    // Cold start is the only place the launch account preference is applied
    // (PERA-4855), and it must land inside the bootstrap gate so the pinned
    // account is selected before the splash lifts.
    it('applies the launch account preference before bootstrap completes', async () => {
        vi.useFakeTimers()

        const { result } = renderHook(() => useAppBootstrap())
        await act(async () => {
            await vi.runAllTimersAsync()
        })

        expect(mocks.applyLaunchAccountPreference).toHaveBeenCalledTimes(1)
        expect(result.current.bootstrapped).toBe(true)
    })

    it('waits for the accounts store to rehydrate before applying the pin', async () => {
        mocks.accountsHasHydrated.mockReturnValue(false)
        let finishHydration: ((state: unknown) => void) | undefined
        mocks.accountsOnFinishHydration.mockImplementation(
            (callback: (state: unknown) => void) => {
                finishHydration = callback
                return () => {}
            },
        )
        vi.useFakeTimers()

        renderHook(() => useAppBootstrap())
        await act(async () => {
            await Promise.resolve()
        })

        expect(mocks.applyLaunchAccountPreference).not.toHaveBeenCalled()

        await act(async () => {
            finishHydration?.(undefined)
            await vi.runAllTimersAsync()
        })

        expect(mocks.applyLaunchAccountPreference).toHaveBeenCalledTimes(1)
    })

    // A store that never finishes rehydrating (corrupt persisted JSON) must not
    // hang the splash gate — the launch preference is simply skipped.
    it('still completes bootstrap when accounts rehydration never finishes', async () => {
        mocks.accountsHasHydrated.mockReturnValue(false)
        mocks.accountsOnFinishHydration.mockImplementation(() => () => {})
        vi.useFakeTimers()

        const { result } = renderHook(() => useAppBootstrap())
        await act(async () => {
            await vi.runAllTimersAsync()
        })

        expect(result.current.bootstrapped).toBe(true)
        expect(result.current.initError).toBe(false)
    })
})

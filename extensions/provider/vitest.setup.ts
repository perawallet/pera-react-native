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

import { vi } from 'vitest'

// `expo-modules-core` references `__DEV__` at module-load time. The
// passkey-autofill native module pulls in `expo`, so any import chain that
// touches PeraProvider triggers this in jsdom. Mirror the apps/mobile setup
// and stub the global so the import chain doesn't crash.
;(globalThis as { __DEV__?: boolean }).__DEV__ = false

const store = new Map<string, string>()

const mockPlatformServices = {
    keyValueStorage: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => store.set(key, value),
        removeItem: (key: string) => {
            store.delete(key)
        },
    },
    analytics: {
        initializeAnalytics() {},
        logEvent() {},
    },
    biometrics: {
        async getSupportedBiometricType() {
            return 'fingerprint'
        },
        async checkBiometricsAvailable() {
            return true
        },
        async authenticate() {
            return true
        },
    },
    remoteConfig: {
        initializeRemoteConfig() {},
        getStringValue(_: string, f?: string) {
            return f ?? ''
        },
        getBooleanValue(_: string, f?: boolean) {
            return f ?? false
        },
        getNumberValue(_: string, f?: number) {
            return f ?? 0
        },
    },
    pushNotification: {
        isSupported: () => true,
        async initializeNotifications() {
            return { unsubscribe: () => {} }
        },
        addNotificationOpenListener() {
            return () => {}
        },
    },
    crashReporting: {
        initializeCrashReporting() {},
        recordNonFatalError() {},
    },
    database: {
        async open() {
            return { driver: null }
        },
        async close() {},
    },
    deviceInfo: {
        getDeviceID() {
            return Promise.resolve('testID')
        },
        getDeviceModel() {
            return 'testModel'
        },
        getDevicePlatform() {
            return 'web'
        },
        getDeviceLocale() {
            return 'testLocale'
        },
        getAppVersion() {
            return 'testVersion'
        },
        getUserAgent() {
            return 'testUserAgent'
        },
        getAppId() {
            return 'testAppId'
        },
        getAppPackage() {
            return 'testPackage'
        },
        getAppBuild() {
            return 'testBuild'
        },
        getAppName() {
            return 'testAppName'
        },
        getDeviceCountry() {
            return 'testCountry'
        },
        getDeviceModelId() {
            return 'testModelId'
        },
        getDeviceOSVersion() {
            return 'testOsVersion'
        },
    },
}

vi.mock('@perawallet/wallet-extension-platform-driver', () => ({
    WithPlatformExtension: () => ({
        ...mockPlatformServices,
        initialize: vi.fn().mockResolvedValue({
            token: 'test-token',
            unsubscribe: vi.fn(),
        }),
    }),
    getPlatformServices: () => mockPlatformServices,
}))

// The passkey autofill extension imports `react-native` (for `Platform.OS`)
// in its service module. `react-native`'s root index uses Flow syntax, which
// rolldown can't parse. Mock the extension entry point so PeraProvider can
// compose `WithPasskeyAutofill` without pulling react-native into the test
// graph.
vi.mock('@perawallet/wallet-extension-passkey-autofill', () => ({
    WithPasskeyAutofill: () => ({
        passkeyAutofill: {
            setMasterKey: vi.fn().mockResolvedValue(undefined),
            setHdRootKeyId: vi.fn().mockResolvedValue(undefined),
            setDerivedMainKey: vi.fn().mockResolvedValue(undefined),
            configureIntentActions: vi.fn().mockResolvedValue(undefined),
            clearCredentials: vi.fn().mockResolvedValue(undefined),
            deleteCredential: vi.fn().mockResolvedValue(undefined),
            getStoredCredentials: vi.fn().mockResolvedValue([]),
            refreshCredentialIdentities: vi.fn().mockResolvedValue(undefined),
            isProviderActive: vi.fn().mockResolvedValue(false),
            openProviderSettings: vi.fn().mockResolvedValue(false),
            onPasskeyAdded: vi.fn().mockReturnValue({ remove: vi.fn() }),
            onPasskeyAuthenticated: vi
                .fn()
                .mockReturnValue({ remove: vi.fn() }),
        },
    }),
}))

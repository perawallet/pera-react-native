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

import { vi, afterEach } from 'vitest'

const store = new Map<string, string>()

// Mock platform driver to prevent "No platform driver configured" errors
vi.mock('@perawallet/wallet-extension-platform-driver', () => ({
    WithPlatformExtension: () => ({
        analytics: {
            logEvent: vi.fn(),
            setUserId: vi.fn(),
            setUserProperty: vi.fn(),
        },
        ageGate: {
            requestAgeRange: vi
                .fn()
                .mockResolvedValue({ status: 'unknown', source: 'platform' }),
            getDeviceCapability: vi.fn().mockResolvedValue('manual'),
        },
        biometrics: {
            getSupportedBiometricType: vi.fn().mockResolvedValue(null),
            checkBiometricsAvailable: vi.fn().mockResolvedValue(false),
            getAvailability: vi.fn().mockResolvedValue('unknown'),
            getSecurityLevel: vi.fn().mockResolvedValue('none'),
            checkEnrollmentBinding: vi.fn().mockResolvedValue('valid'),
            clearEnrollmentBinding: vi.fn().mockResolvedValue(undefined),
            armBiometricBinding: vi.fn().mockResolvedValue(null),
            unwrapBiometricToken: vi
                .fn()
                .mockResolvedValue({ success: false, reason: 'unavailable' }),
        },
        crashReporting: {
            log: vi.fn(),
            recordError: vi.fn(),
        },
        // Both drives, matching the iOS `deviceInfo` mock. A spec exercising a
        // cloud save or read overrides these per case.
        cloudFileStorage: {
            getAvailableStores: vi
                .fn()
                .mockReturnValue(['icloud', 'googleDrive']),
            save: vi.fn().mockResolvedValue('saved'),
            read: vi.fn().mockResolvedValue({ status: 'cancelled' }),
        },
        deviceInfo: {
            getDevicePlatform: () => 'ios',
            getDeviceModel: () => 'iPhone',
            getDeviceId: () => 'test-device-id',
            getVersion: () => '1.0.0',
            // `getAppVersion` is the name on DeviceInfoService; `getVersion`
            // above is not on the interface at all.
            getAppVersion: () => '1.0.0',
            getBuildNumber: () => '1',
            getDeviceLocale: () => 'en-US',
            getDeviceLocales: () => ['en-US'],
            getDeviceLanguage: () => 'en',
        },
        firebase: {
            getToken: vi.fn().mockResolvedValue('mock-token'),
        },
        keyValueStorage: {
            getItem: (key: string) => store.get(key) ?? null,
            setItem: (key: string, value: string) => store.set(key, value),
            removeItem: (key: string) => {
                store.delete(key)
            },
        },
        pushNotifications: {
            requestPermission: vi.fn().mockResolvedValue(true),
            getToken: vi.fn().mockResolvedValue('mock-token'),
        },
        remoteConfig: {
            initializeRemoteConfig: vi.fn(),
            getStringValue: vi
                .fn()
                .mockImplementation(
                    (_key: string, fallback?: string) => fallback ?? '',
                ),
            getBooleanValue: vi
                .fn()
                .mockImplementation(
                    (_key: string, fallback?: boolean) => fallback ?? false,
                ),
            getNumberValue: vi
                .fn()
                .mockImplementation(
                    (_key: string, fallback?: number) => fallback ?? 0,
                ),
            // Firebase-style remnants retained for any callers that haven't
            // migrated to the RemoteConfigService API.
            fetchAndActivate: vi.fn().mockResolvedValue(true),
            getValue: vi.fn().mockReturnValue({ asString: () => '' }),
            getBoolean: vi.fn().mockReturnValue(false),
            getString: vi.fn().mockReturnValue(''),
        },
        // Dormant defaults: card push provisioning reports unavailable, so
        // suites exercise today's manual-instructions fallback.
        walletProvisioning: {
            checkWalletAvailability: vi.fn().mockResolvedValue(false),
            getCardStatusBySuffix: vi.fn().mockResolvedValue('not found'),
            addCardToAppleWallet: vi.fn().mockResolvedValue('canceled'),
            addCardToGoogleWallet: vi.fn().mockResolvedValue('canceled'),
        },
    }),
    getPlatformServices: () => ({
        keyValueStorage: {
            getItem: (key: string) => store.get(key) ?? null,
            setItem: (key: string, value: string) => store.set(key, value),
            removeItem: (key: string) => {
                store.delete(key)
            },
        },
    }),
}))

vi.mock('@perawallet/wallet-extension-provider', () => {
    const providerValue = {
        analytics: {
            logEvent: vi.fn(),
            setUserId: vi.fn(),
            setUserProperty: vi.fn(),
        },
        ageGate: {
            requestAgeRange: vi
                .fn()
                .mockResolvedValue({ status: 'unknown', source: 'platform' }),
            getDeviceCapability: vi.fn().mockResolvedValue('manual'),
        },
        biometrics: {
            getSupportedBiometricType: vi.fn().mockResolvedValue(null),
            checkBiometricsAvailable: vi.fn().mockResolvedValue(false),
            getAvailability: vi.fn().mockResolvedValue('unknown'),
            getSecurityLevel: vi.fn().mockResolvedValue('none'),
            checkEnrollmentBinding: vi.fn().mockResolvedValue('valid'),
            clearEnrollmentBinding: vi.fn().mockResolvedValue(undefined),
            armBiometricBinding: vi.fn().mockResolvedValue(null),
            unwrapBiometricToken: vi
                .fn()
                .mockResolvedValue({ success: false, reason: 'unavailable' }),
        },
        crashReporting: {
            log: vi.fn(),
            recordError: vi.fn(),
        },
        // Both drives, matching the iOS `deviceInfo` mock. A spec exercising a
        // cloud save or read overrides these per case.
        cloudFileStorage: {
            getAvailableStores: vi
                .fn()
                .mockReturnValue(['icloud', 'googleDrive']),
            save: vi.fn().mockResolvedValue('saved'),
            read: vi.fn().mockResolvedValue({ status: 'cancelled' }),
        },
        deviceInfo: {
            getDevicePlatform: () => 'ios',
            getDeviceModel: () => 'iPhone',
            getDeviceId: () => 'test-device-id',
            getVersion: () => '1.0.0',
            getAppVersion: () => '1.0.0',
            getBuildNumber: () => '1',
            getDeviceLocale: () => 'en-US',
            getDeviceLocales: () => ['en-US'],
            getDeviceLanguage: () => 'en',
            getUserAgent: () => 'PeraWallet/test',
        },
        keyValueStorage: {
            getItem: (key: string) => store.get(key) ?? null,
            setItem: (key: string, value: string) => store.set(key, value),
            removeItem: (key: string) => {
                store.delete(key)
            },
        },
        remoteConfig: {
            initializeRemoteConfig: vi.fn(),
            getStringValue: vi.fn().mockReturnValue(''),
            getBooleanValue: vi.fn().mockReturnValue(false),
            getNumberValue: vi.fn().mockReturnValue(0),
        },
        // A real (empty) registry, as `WithHardwareWalletExtension` supplies in
        // production, so a spec can register a fake transport through it.
        hardwareWalletRegistry:
            require('@perawallet/wallet-extension-hardware-wallet').createHardwareWalletRegistry(),
        key: {
            store: {
                remove: vi.fn(),
                import: vi.fn(),
                sign: vi.fn(),
            },
        },
        // Real store over the same in-memory map as `keyValueStorage`, matching
        // production where `WithConnections` persists through `provider.keyValueStorage`.
        connections: {
            store: require('@perawallet/wallet-extension-connections').createConnectionStore(
                {
                    storage: {
                        getItem: (key: string) => store.get(key) ?? null,
                        setItem: (key: string, value: string) =>
                            store.set(key, value),
                        removeItem: (key: string) => {
                            store.delete(key)
                        },
                    },
                },
            ),
        },
    }
    return {
        getProvider: () => providerValue,
        PeraWalletProvider: ({ children }: { children: React.ReactNode }) =>
            children,
        usePeraProvider: () => providerValue,
        // Keystore hydration completes before `RootComponent` (and so
        // `ConnectionsProvider`) mounts, so an already-resolved promise is faithful.
        getKeystore: () => ({ ready: Promise.resolve() }),
    }
})

// The passkey-autofill extension eagerly imports the
// `@algorandfoundation/react-native-passkey-autofill` Expo module, which
// triggers `requireNativeModule` at import time. Under jsdom that drags in
// `expo/src/winter/runtime` and crashes with `Cannot find module
// './ImportMetaRegistry'`. Mock the workspace extension entry point so
// none of those native imports run inside unit/integration tests.
vi.mock('@perawallet/wallet-extension-passkey-autofill', () => {
    const passkeyAutofill = {
        setMasterKey: vi.fn().mockResolvedValue(undefined),
        setHdRootKeyId: vi.fn().mockResolvedValue(undefined),
        setMainKeyId: vi.fn().mockResolvedValue(undefined),
        getMainKeyId: vi.fn().mockResolvedValue(null),
        configureIntentActions: vi.fn().mockResolvedValue(undefined),
        clearCredentials: vi.fn().mockResolvedValue(undefined),
        deleteCredential: vi.fn().mockResolvedValue(undefined),
        getStoredCredentials: vi.fn().mockResolvedValue([]),
        refreshCredentialIdentities: vi.fn().mockResolvedValue(undefined),
        isProviderActive: vi.fn().mockResolvedValue(false),
        openProviderSettings: vi.fn().mockResolvedValue(false),
        onPasskeyAdded: vi.fn().mockReturnValue({ remove: vi.fn() }),
        onPasskeyAuthenticated: vi.fn().mockReturnValue({ remove: vi.fn() }),
    }
    return {
        name: '@perawallet/wallet-extension-passkey-autofill',
        WithPasskeyAutofill: () => ({ passkeyAutofill }),
        PasskeyAutofillService: class {},
    }
})

// Mock @perawallet/wallet-extension-platform.
// Spreads the real module first: this factory only stubs the service hooks, and
// anything it forgot used to arrive as `undefined` — silently, so an error class
// from this package stopped being a constructor and a new RemoteConfigKey could
// not be switched on in a test.
vi.mock('@perawallet/wallet-extension-platform', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-extension-platform')
    >()),
    createCrashReportingErrorReporter: vi.fn(() => vi.fn()),
    useID: vi.fn(() => 'id'),
    useDeviceID: vi.fn(() => 'device-id'),
    useDeviceInfoService: vi.fn(() => ({
        getDeviceLocale: vi.fn(() => 'en-US'),
        getAppVersion: vi.fn(() => '1.0.0'),
        getDevicePlatform: vi.fn(() => 'ios'),
        getDeviceModel: vi.fn(() => 'iPhone'),
        getUserAgent: vi.fn(() => 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)'),
    })),
    useAnalyticsService: vi.fn(() => ({
        logEvent: vi.fn(),
    })),
    RemoteConfigDefaults: {
        pera_7_migration: false,
    },
    AnalyticsServiceContainerKey: 'AnalyticsService',
    useNotificationsListQuery: vi.fn(() => ({
        data: [],
        isPending: false,
        fetchNextPage: vi.fn(),
        isFetchingNextPage: false,
        isRefetching: false,
        refetch: vi.fn(),
    })),
    useFilteredNotificationsQuery: vi.fn(() => ({
        notifications: [],
        isPending: false,
        fetchNextPage: vi.fn(),
        isFetchingNextPage: false,
        isRefetching: false,
        refetch: vi.fn(),
    })),
}))

afterEach(() => {
    store.clear()
})

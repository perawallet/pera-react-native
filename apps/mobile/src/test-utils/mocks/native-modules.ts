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

// Mock react-native-vision-camera
vi.mock('react-native-vision-camera', () => {
    return {
        Camera: vi.fn(),
        useCameraDevice: vi.fn(() => ({
            id: 'device-id',
            devices: ['wide-angle-camera'],
            hasFlash: true,
            isMultiCam: false,
        })),
        useCameraPermission: vi.fn(() => ({
            hasPermission: true,
            requestPermission: vi.fn().mockResolvedValue(true),
        })),
    }
})

// Mock react-native-vision-camera-barcode-scanner (v5 code-scanning path)
vi.mock('react-native-vision-camera-barcode-scanner', () => {
    return {
        useBarcodeScannerOutput: vi.fn(() => ({})),
    }
})

vi.mock('react-native-keychain', () => ({
    setGenericPassword: vi.fn().mockResolvedValue(true),
    getGenericPassword: vi.fn().mockResolvedValue({
        username: 'user',
        password: 'test-password',
    }),
    resetGenericPassword: vi.fn().mockResolvedValue(true),
    getAllGenericPasswordServices: vi.fn().mockResolvedValue([]),
    ACCESSIBLE: {
        WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WhenUnlockedThisDeviceOnly',
    },
    ACCESS_CONTROL: {
        BIOMETRY_CURRENT_SET: 'BiometryCurrentSet',
    },
    SECURITY_LEVEL: {
        SECURE_HARDWARE: 'SecureHardware',
    },
}))

vi.mock('react-native-quick-base64', () => ({
    toByteArray: vi.fn(),
    fromByteArray: vi.fn(),
    trim: vi.fn(),
}))

vi.mock('react-native-nitro-modules', () => ({
    NitroModules: {
        get: vi.fn(),
    },
}))

vi.mock('react-native-quick-crypto', () => ({
    default: {
        createHash: vi.fn(),
        createHmac: vi.fn(),
        randomBytes: vi.fn(),
    },
    // Named: the keystore engine is constructed with this at module scope.
    subtle: globalThis.crypto?.subtle,
}))

vi.mock('react-native-mmkv', () => {
    function createMMKV() {
        const store = new Map<string, string>()
        return {
            getString(key: string) {
                return store.get(key) ?? undefined
            },
            set(key: string, value: string) {
                store.set(key, String(value))
            },
            remove(key: string) {
                return store.delete(key)
            },
            getAllKeys() {
                return Array.from(store.keys())
            },
        }
    }
    return { createMMKV }
})

// @react-native-community/netinfo ships untranspiled sources vitest can't
// parse. Connectivity in tests is driven through useNetworkStatusStore.
vi.mock('@react-native-community/netinfo', () => ({
    default: {
        configure: vi.fn(),
        addEventListener: vi.fn(() => () => {}),
        fetch: vi.fn(async () => ({
            isConnected: true,
            isInternetReachable: true,
        })),
    },
}))

vi.mock('@react-native-clipboard/clipboard', () => ({
    default: {
        setString: vi.fn(),
        getString: vi.fn(),
        hasString: vi.fn(),
    },
}))

// Mock react-native-rate-app (native module not available in jsdom)
vi.mock('react-native-rate-app', () => ({
    default: {
        requestReview: vi.fn().mockResolvedValue(true),
        openStoreForReview: vi.fn().mockResolvedValue(true),
        getAndroidMarketUrl: vi.fn(() => ''),
    },
    AndroidMarket: {
        GOOGLE: 'google',
        AMAZON: 'amazon',
        SAMSUNG: 'samsung',
        HUAWEI: 'huawei',
    },
}))

// Mock react-native-share (native module not resolvable in vitest)
vi.mock('react-native-share', () => ({
    default: {
        open: vi.fn().mockResolvedValue({ success: true }),
        shareSingle: vi.fn().mockResolvedValue({ success: true }),
    },
    Social: {},
}))

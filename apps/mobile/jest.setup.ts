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

/* eslint-disable @typescript-eslint/no-explicit-any*/
import 'reflect-metadata'

// Clean up after each test
afterEach(() => {
    jest.clearAllMocks()
})

jest.mock('react-native-device-info', () => ({
    default: {
        getApplicationName: () => 'Test App',
        getBundleId: () => 'com.test.app',
        getVersion: () => '1.0.0',
        getSystemVersion: () => '17.0',
        getDeviceId: () => 'test-device',
        getUniqueId: () => Promise.resolve('unique-id'),
        getModel: () => 'iPhone',
    },
}))

jest.mock('react-native-keychain', () => ({
    setGenericPassword: jest.fn().mockResolvedValue(true),
    getGenericPassword: jest.fn().mockResolvedValue({
        username: 'user',
        password: 'test-password',
    }),
    resetGenericPassword: jest.fn().mockResolvedValue(true),
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

// // Mock React Native core modules
jest.mock('react-native', () => {
    const Platform = {
        OS: 'ios',
        select: jest.fn(obj => obj.ios || obj.default),
    }
    return {
        Platform,
        NativeModules: {
            SettingsManager: {
                settings: {
                    AppleLocale: 'en_US',
                    AppleLanguages: ['en_US', 'fr_FR'],
                },
            },
            I18nManager: {
                getConstants: jest.fn(() => ({
                    localeIdentifier: 'en_US',
                })),
            },
        },
        Dimensions: {
            get: jest.fn(() => ({ width: 375, height: 812 })),
            addEventListener: jest.fn(),
            removeEventListener: jest.fn(),
        },
        StatusBar: {
            setBarStyle: jest.fn(),
            setBackgroundColor: jest.fn(),
        },
        Alert: {
            alert: jest.fn(),
        },
        StyleSheet: {
            create: jest.fn(styles => styles),
            hairlineWidth: 1,
            absoluteFill: {
                position: 'absolute',
                top: 0,
                left: 0,
                bottom: 0,
                right: 0,
            },
        },
        TouchableOpacity: jest
            .fn()
            .mockImplementation(({ children }) => children),
        View: jest.fn().mockImplementation(({ children }) => children),
        Text: jest.fn().mockImplementation(({ children }) => children),
        Image: jest.fn().mockImplementation(({ children }) => children),
        ScrollView: jest.fn().mockImplementation(({ children }) => children),
        TextInput: jest.fn().mockImplementation(({ children }) => children),
        Modal: jest.fn().mockImplementation(({ children }) => children),
        ActivityIndicator: jest.fn().mockImplementation(({ children }) => children),
        Pressable: jest.fn().mockImplementation(({ children }) => children),
        Appearance: {
            getColorScheme: jest.fn(() => 'light'),
            addChangeListener: jest.fn(),
            removeChangeListener: jest.fn(),
        },
        Linking: {
            openURL: jest.fn(),
            canOpenURL: jest.fn(),
            getInitialURL: jest.fn(),
            addEventListener: jest.fn(),
            removeEventListener: jest.fn(),
        },
        AppState: {
            currentState: 'active',
            addEventListener: jest.fn(),
            removeEventListener: jest.fn(),
        },
        InteractionManager: {
            runAfterInteractions: jest.fn(cb => cb()),
        },
        Keyboard: {
            dismiss: jest.fn(),
            addListener: jest.fn(),
            removeListener: jest.fn(),
        },
        PixelRatio: {
            get: jest.fn(() => 1),
            getFontScale: jest.fn(() => 1),
            getPixelSizeForLayoutSize: jest.fn(size => size),
            roundToNearestPixel: jest.fn(size => size),
        },
    }
}, { virtual: true })

jest.mock('react-native-safe-area-context', () => {
    const inset = { top: 0, right: 0, bottom: 0, left: 0 }
    return {
        SafeAreaProjestder: jest
            .fn()
            .mockImplementation(({ children }) => children),
        SafeAreaConsumer: jest
            .fn()
            .mockImplementation(({ children }) => children(inset)),
        useSafeAreaInsets: jest.fn().mockImplementation(() => inset),
    }
})



jest.mock('react-native-quick-base64', () => ({
    toByteArray: jest.fn(),
    fromByteArray: jest.fn(),
    trim: jest.fn(),
}))

jest.mock('react-native-nitro-modules', () => ({
    NitroModules: {
        get: jest.fn(),
    },
}))

jest.mock('react-native-quick-crypto', () => ({
    default: {
        createHash: jest.fn(),
        createHmac: jest.fn(),
        randomBytes: jest.fn(),
    },
}))

// Basic NativeEventEmitter dependency to avoid errors when no native module is provided
jest.mock('react-native/Libraries/EventEmitter/NativeEventEmitter', () => {
    return class NativeEventEmitter { }
})

// Mock React Navigation
jest.mock('@react-navigation/native', () => ({
    useNavigation: () => ({
        navigate: jest.fn(),
        goBack: jest.fn(),
        reset: jest.fn(),
        setOptions: jest.fn(),
    }),
    useRoute: () => ({
        params: {},
    }),
    useFocusEffect: jest.fn(),
    NavigationContainer: ({ children }: any) => children,
}))

jest.mock('@react-navigation/bottom-tabs', () => ({
    createBottomTabNavigator: jest.fn(() => ({
        Navigator: ({ children }: any) => children,
        Screen: ({ children }: any) => children,
    })),
}))

jest.mock('@react-navigation/native-stack', () => ({
    createNativeStackNavigator: jest.fn(() => ({
        Navigator: ({ children }: any) => children,
        Screen: ({ children }: any) => children,
    })),
}))

// Common native modules used in the app, stubbed with minimal implementations
jest.mock('@react-native-firebase/app', () => ({
    default: { app: jest.fn(() => ({})) },
}))

jest.mock('@react-native-firebase/crashlytics', () => ({
    getCrashlytics: () => ({
        setCrashlyticsCollectionEnabled: jest.fn(),
        recordError: jest.fn(),
        log: jest.fn(),
    }),
}))

jest.mock('@react-native-firebase/messaging', () => ({
    getMessaging: () => ({
        registerDeviceForRemoteMessages: jest.fn(),
        onMessage: jest.fn(() => jest.fn()),
        getToken: jest.fn(async () => 'token'),
    }),
}))

jest.mock('@react-native-firebase/remote-config', () => ({
    getRemoteConfig: () => ({
        setDefaults: jest.fn(async () => { }),
        fetchAndActivate: jest.fn(async () => true),
        setConfigSettings: jest.fn(),
        getValue: jest.fn(() => ({
            asString: () => '',
            asBoolean: () => false,
            asNumber: () => 0,
        })),
    }),
}))

jest.mock('@notifee/react-native', () => ({
    default: {
        requestPermission: jest.fn(async () => true),
        onForegroundEvent: jest.fn(() => jest.fn()),
    },
}))

jest.mock('react-native-mmkv', () => {
    class MMKV {
        private store = new Map<string, string>()
        getString(key: string) {
            return this.store.get(key) ?? null
        }
        set(key: string, value: string) {
            this.store.set(key, String(value))
        }
        delete(key: string) {
            this.store.delete(key)
        }
    }
    return { MMKV }
})

jest.mock('@notifee/react-native', () => {
    return {
        AuthorizationStatus: 'AUTHORIZED',
        notifee: {
            requestPermission: jest.fn(),
            createChannel: jest.fn(),
            displayNotification: jest.fn(),
            onForegroundEvent: jest.fn(),
        },
    }
})

jest.mock('react-native-webview', () => {
    const { View } = require('react-native')
    return {
        default: jest.fn().mockImplementation(() => View),
        WebView: jest.fn().mockImplementation(() => View),
    }
})

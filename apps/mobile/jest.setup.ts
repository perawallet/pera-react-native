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
jest.mock(
    'react-native',
    () => {
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
                flatten: jest.fn(styles => (Array.isArray(styles) ? Object.assign({}, ...styles) : styles)),
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
                .mockImplementation((props) => require('react').createElement('TouchableOpacity', props, props.children)),
            View: jest.fn().mockImplementation((props) => require('react').createElement('View', props, props.children)),
            Text: jest.fn().mockImplementation((props) => require('react').createElement('Text', props, props.children)),
            Image: jest.fn().mockImplementation((props) => require('react').createElement('Image', props, props.children)),
            ScrollView: jest
                .fn()
                .mockImplementation((props) => require('react').createElement('ScrollView', props, props.children)),
            TextInput: jest.fn().mockImplementation((props) => require('react').createElement('TextInput', props, props.children)),
            Modal: jest.fn().mockImplementation((props) => require('react').createElement('Modal', props, props.children)),
            ActivityIndicator: jest
                .fn()
                .mockImplementation((props) => require('react').createElement('ActivityIndicator', props, props.children)),
            Pressable: jest.fn().mockImplementation((props) => require('react').createElement('Pressable', props, props.children)),
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
            Easing: {
                inOut: jest.fn(),
                out: jest.fn(),
                ease: jest.fn(),
                linear: jest.fn(),
                quad: jest.fn(),
            },
            Animated: {
                timing: jest.fn(() => ({ start: jest.fn() })),
                spring: jest.fn(() => ({ start: jest.fn() })),
                event: jest.fn(),
                Value: jest.fn(() => ({
                    setValue: jest.fn(),
                    interpolate: jest.fn(() => '0px')
                })),
                createAnimatedComponent: jest.fn(c => c),
                View: jest.fn(({ children }) => children),
                Text: jest.fn(({ children }) => children),
            },
            PixelRatio: {
                get: jest.fn(() => 1),
                getFontScale: jest.fn(() => 1),
                getPixelSizeForLayoutSize: jest.fn(size => size),
                roundToNearestPixel: jest.fn(size => size),
            },
        }
    },
    { virtual: true },
)

jest.mock('react-native-safe-area-context', () => {
    const inset = { top: 0, right: 0, bottom: 0, left: 0 }
    return {
        SafeAreaProvider: jest
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
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { View } = require('react-native')
    return {
        default: jest.fn().mockImplementation(() => View),
        WebView: jest.fn().mockImplementation(() => View),
    }
})

// Mock Gesture Handler
jest.mock('react-native-gesture-handler', () => {
    const View = require('react-native').View
    return {
        Swipeable: View,
        DrawerLayout: View,
        State: {},
        ScrollView: View,
        Slider: View,
        Switch: View,
        TextInput: View,
        ToolbarAndroid: View,
        ViewPagerAndroid: View,
        DrawerLayoutAndroid: View,
        WebView: View,
        NativeViewGestureHandler: View,
        TapGestureHandler: View,
        FlingGestureHandler: View,
        ForceTouchGestureHandler: View,
        LongPressGestureHandler: View,
        PanGestureHandler: View,
        PinchGestureHandler: View,
        RotationGestureHandler: View,
        /* Buttons */
        RawButton: View,
        BaseButton: View,
        RectButton: View,
        BorderlessButton: View,
        /* Other */
        FlatList: View,
        gestureHandlerRootHOC: jest.fn(),
        Directions: {},
    }
})

jest.mock('react-native-vector-icons/MaterialCommunityIcons', () => 'Icon')
jest.mock('react-native-vector-icons/Ionicons', () => 'Icon')
jest.mock('react-native-vector-icons/FontAwesome', () => 'Icon')
jest.mock('react-native-vector-icons/FontAwesome5', () => 'Icon')

jest.mock('@rneui/themed', () => {
    const React = require('react')
    const { View, Text, TextInput } = require('react-native')

    const colors = {
        buttonPrimaryBg: '#FABADA',
        buttonPrimaryText: '#fff',
        textMain: '#000',
        textGray: '#ccc',
        buttonSquareText: '#000',
        textWhite: '#fff',
        linkPrimary: 'blue',
        error: 'red',
        helperPositive: 'green',
        primary: 'blue',
        secondary: 'gray',
        background: 'white',
        layerGrayLighter: '#f0f0f0',
        white: '#ffffff',
        black: '#000000',
        grey0: '#e1e8ee',
        grey1: '#bdc6cf',
        grey2: '#86939e',
        grey3: '#5e6977',
        grey4: '#43484d',
        grey5: '#3e3e3e',
    }

    const mockTheme = {
        colors,
        lightColors: colors,
        darkColors: colors,
        spacing: {
            xs: 4, sm: 8, md: 16, lg: 24, xl: 32, '2xl': 40, '3xl': 48, '4xl': 56
        },
        mode: 'light',
    }

    return {
        makeStyles: (styleFn) => (props) => {
            return styleFn(mockTheme, props) || {}
        },
        useTheme: () => ({ theme: mockTheme }),
        createTheme: () => mockTheme,
        ThemeProvider: ({ children }) => children,
        withTheme: (Component) => (props) => React.createElement(Component, { ...props, theme: mockTheme }),

        // Mock Components
        Button: (props) => React.createElement(View, props, props.title ? React.createElement(Text, null, props.title) : props.children),
        Text: (props) => React.createElement(Text, props, props.children),
        Input: (props) => React.createElement(TextInput, { ...props, testID: 'RNEInput' }),
        CheckBox: (props) => React.createElement(View, props, props.children),
        BottomSheet: ({ isVisible, children, ...props }) => isVisible ? React.createElement(View, { ...props, testID: 'RNEBottomSheet' }, children) : null,
        Icon: (props) => React.createElement(View, props),
        ListItem: Object.assign(
            (props) => React.createElement(View, props, props.children),
            {
                Content: (props) => React.createElement(View, props, props.children),
                Title: (props) => React.createElement(Text, props, props.children),
                Subtitle: (props) => React.createElement(Text, props, props.children),
                Chevron: (props) => React.createElement(View, props),
            }
        ),
    }
})

jest.mock('react-native-notifier', () => {
    const React = require('react')
    const { View } = require('react-native')
    return {
        NotifierRoot: ({ children }) => React.createElement(View, {}, children),
        NotifierWrapper: ({ children }) => React.createElement(View, {}, children),
        Notifier: {
            showNotification: jest.fn(),
            hideNotification: jest.fn(),
        },
    }
})

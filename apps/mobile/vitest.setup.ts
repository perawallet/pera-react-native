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
/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable max-lines */
import 'reflect-metadata'
import { vi, afterEach } from 'vitest'
// import '@testing-library/jest-native/extend-expect'

// Mock react-native-reanimated
vi.mock('react-native-reanimated', () => {
    const React = require('react')
    const Reanimated = {
        default: {
            call: () => {},
            createAnimatedComponent: (component: any) => component,
            View: (props: any) =>
                React.createElement('div', props, props.children),
            Text: (props: any) =>
                React.createElement('div', props, props.children),
            Image: (props: any) => React.createElement('img', props),
            ScrollView: (props: any) =>
                React.createElement('div', props, props.children),
            addWhitelistedNativeProps: () => {},
            addWhitelistedUIProps: () => {},
        },
        useSharedValue: (v: any) => ({ value: v }),
        useDerivedValue: (a: any) => ({ value: a() }),
        useAnimatedStyle: () => ({}),
        useAnimatedProps: () => ({}),
        useAnimatedGestureHandler: () => {},
        useAnimatedScrollHandler: () => {},
        useAnimatedReaction: () => {},
        withTiming: (toValue: any) => toValue,
        withSpring: (toValue: any) => toValue,
        withDecay: () => 0,
        withDelay: (_: any, toValue: any) => toValue,
        withSequence: (...args: any[]) => args[args.length - 1],
        withRepeat: (anim: any) => anim,
        runOnJS: (fn: any) => fn,
        runOnUI: (fn: any) => fn,
        makeMutable: (v: any) => ({ value: v }),
        cancelAnimation: () => {},
        interpolate: () => 0,
        Extrapolate: { CLAMP: 'clamp' },
        Layout: {
            springify: () => ({ damping: () => ({}) }),
        },
        FadeIn: {
            duration: () => ({}),
        },
        FadeInDown: {
            duration: () => ({}),
        },
        FadeOut: {
            duration: () => ({}),
        },
        SlideInDown: {
            // Used in QRScannerView
            springify: () => ({ damping: () => ({}) }),
        },
        SlideOutDown: {
            springify: () => ({ damping: () => ({}) }),
        },
    }
    return Reanimated
})

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
        useCodeScanner: vi.fn(),
    }
})

// Mock PWIcon component to avoid SVG import issues
vi.mock('@components/PWIcon', () => {
    const React = require('react')
    return {
        default: ({ onPress, name, testID }: any) =>
            React.createElement('button', {
                onClick: onPress,
                'data-testid': testID || `icon-${name}`,
            }),
    }
})
vi.mock('@components/PWIcon/PWIcon', () => {
    const React = require('react')
    return {
        default: ({ onPress, name, testID }: any) =>
            React.createElement('button', {
                onClick: onPress,
                'data-testid': testID || `icon-${name}`,
            }),
    }
})

// Mock react-native-ratings
vi.mock('react-native-ratings', () => ({
    Rating: vi.fn(() => null),
}))

// Clean up after each test
afterEach(() => {
    vi.clearAllMocks()
})

vi.mock('react-native-device-info', () => ({
    default: {
        getApplicationName: () => 'Pera Wallet',
        getBundleId: () => 'com.test.app',
        getVersion: () => '1.0.0',
        getBuildNumber: () => '1',
        getReadableVersion: () => '1.0.0.1',
        getSystemVersion: () => '17.0',
        getDeviceId: () => 'test-device',
        getUniqueId: () => Promise.resolve('unique-id'),
        getModel: () => 'iPhone',
    },
}))

vi.mock('react-native-keychain', () => ({
    setGenericPassword: vi.fn().mockResolvedValue(true),
    getGenericPassword: vi.fn().mockResolvedValue({
        username: 'user',
        password: 'test-password',
    }),
    resetGenericPassword: vi.fn().mockResolvedValue(true),
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

// Mock React Native core modules
vi.mock('react-native', () => {
    const Platform = {
        OS: 'ios',
        select: vi.fn(obj => obj.ios || obj.default),
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
                getConstants: vi.fn(() => ({
                    localeIdentifier: 'en_US',
                })),
            },
        },
        I18nManager: {
            isRTL: false,
            allowRTL: vi.fn(),
            forceRTL: vi.fn(),
            swapLeftAndRightInRTL: vi.fn(),
            getConstants: vi.fn(() => ({ isRTL: false })),
        },
        useColorScheme: vi.fn(() => 'light'),
        useWindowDimensions: vi.fn(() => ({ width: 375, height: 812 })),
        Dimensions: {
            get: vi.fn(() => ({ width: 375, height: 812 })),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
        },
        StatusBar: {
            setBarStyle: vi.fn(),
            setBackgroundColor: vi.fn(),
        },
        Alert: {
            alert: vi.fn(),
        },
        StyleSheet: {
            create: vi.fn(styles => styles),
            flatten: vi.fn(styles =>
                Array.isArray(styles) ? Object.assign({}, ...styles) : styles,
            ),
            hairlineWidth: 1,
            absoluteFill: {
                position: 'absolute',
                top: 0,
                left: 0,
                bottom: 0,
                right: 0,
            },
        },
        // Map React Native components to web-compatible HTML elements with proper event handling
        TouchableOpacity: vi
            .fn()
            .mockImplementation(
                ({ onPress, children, activeOpacity, ...props }) => {
                    const React = require('react')

                    void activeOpacity

                    return React.createElement(
                        'button',
                        { ...props, onClick: onPress },
                        children,
                    )
                },
            ),
        KeyboardAvoidingView: vi
            .fn()
            .mockImplementation(props =>
                require('react').createElement('div', props, props.children),
            ),
        View: vi
            .fn()
            .mockImplementation(props =>
                require('react').createElement('div', props, props.children),
            ),
        Text: vi
            .fn()
            .mockImplementation(props =>
                require('react').createElement('span', props, props.children),
            ),
        Image: Object.assign(
            vi
                .fn()
                .mockImplementation(props =>
                    require('react').createElement(
                        'img',
                        props,
                        props.children,
                    ),
                ),
            {
                resolveAssetSource: vi.fn(() => ({
                    uri: 'mock-image-uri',
                    width: 100,
                    height: 100,
                })),
            },
        ),
        ImageBackground: Object.assign(
            vi
                .fn()
                .mockImplementation(props =>
                    require('react').createElement(
                        'div',
                        { ...props, 'data-testid': 'ImageBackground' },
                        props.children,
                    ),
                ),
            {
                resolveAssetSource: vi.fn(() => ({
                    uri: 'mock-image-uri',
                    width: 100,
                    height: 100,
                })),
            },
        ),
        ScrollView: vi
            .fn()
            .mockImplementation(props =>
                require('react').createElement('div', props, props.children),
            ),
        TextInput: vi
            .fn()
            .mockImplementation(props =>
                require('react').createElement('input', props, props.children),
            ),
        Modal: vi
            .fn()
            .mockImplementation(props =>
                require('react').createElement('div', props, props.children),
            ),
        ActivityIndicator: vi
            .fn()
            .mockImplementation(props =>
                require('react').createElement(
                    'div',
                    { ...props, 'data-testid': 'activity-indicator' },
                    'Loading...',
                ),
            ),
        Pressable: vi.fn().mockImplementation(({ onPress, ...props }) => {
            const React = require('react')
            return React.createElement(
                'button',
                { ...props, onClick: onPress },
                props.children,
            )
        }),
        Appearance: {
            getColorScheme: vi.fn(() => 'light'),
            addChangeListener: vi.fn(),
            removeChangeListener: vi.fn(),
        },
        Linking: {
            openURL: vi.fn(),
            canOpenURL: vi.fn(),
            getInitialURL: vi.fn(),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
        },
        AppState: {
            currentState: 'active',
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
        },
        InteractionManager: {
            runAfterInteractions: vi.fn(cb => cb()),
        },
        Keyboard: {
            dismiss: vi.fn(),
            addListener: vi.fn(),
            removeListener: vi.fn(),
        },
        Easing: {
            inOut: vi.fn(),
            out: vi.fn(),
            ease: vi.fn(),
            linear: vi.fn(),
            quad: vi.fn(),
        },
        Animated: {
            timing: vi.fn(() => ({ start: vi.fn() })),
            spring: vi.fn(() => ({ start: vi.fn() })),
            event: vi.fn(),
            Value: vi.fn(() => ({
                setValue: vi.fn(),
                interpolate: vi.fn(() => '0px'),
            })),
            createAnimatedComponent: vi.fn(c => c),
            View: vi.fn(({ children }) => children),
            Text: vi.fn(({ children }) => children),
        },
        PixelRatio: {
            get: vi.fn(() => 1),
            getFontScale: vi.fn(() => 1),
            getPixelSizeForLayoutSize: vi.fn(size => size),
            roundToNearestPixel: vi.fn(size => size),
        },
    }
})

vi.mock('react-native-safe-area-context', () => {
    const inset = { top: 0, right: 0, bottom: 0, left: 0 }
    return {
        SafeAreaProvider: vi
            .fn()
            .mockImplementation(({ children }) => children),
        SafeAreaConsumer: vi
            .fn()
            .mockImplementation(({ children }) => children(inset)),
        useSafeAreaInsets: vi.fn().mockImplementation(() => inset),
    }
})

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
}))

// Basic NativeEventEmitter dependency to avoid errors when no native module is provided
vi.mock('react-native/Libraries/EventEmitter/NativeEventEmitter', () => {
    return class NativeEventEmitter {}
})

// Mock React Navigation
vi.mock('@react-navigation/native', () => ({
    useNavigation: () => ({
        navigate: vi.fn(),
        goBack: vi.fn(),
        reset: vi.fn(),
        setOptions: vi.fn(),
    }),
    useRoute: () => ({
        params: {},
    }),
    useFocusEffect: vi.fn(),
    NavigationContainer: ({ children }: any) => children,
    DefaultTheme: {
        colors: {
            primary: 'blue',
            background: 'white',
            card: 'white',
            text: 'black',
            border: 'gray',
            notification: 'red',
        },
    },
}))

vi.mock('@react-navigation/bottom-tabs', () => ({
    createBottomTabNavigator: vi.fn(() => ({
        Navigator: ({ children }: any) => children,
        Screen: ({ children }: any) => children,
    })),
}))

vi.mock('@react-navigation/native-stack', () => ({
    createNativeStackNavigator: vi.fn(() => ({
        Navigator: ({ children }: any) => children,
        Screen: ({ children }: any) => children,
    })),
}))

// Common native modules used in the app, stubbed with minimal implementations
vi.mock('@react-native-firebase/app', () => ({
    default: { app: vi.fn(() => ({})) },
}))

vi.mock('@react-native-firebase/crashlytics', () => ({
    getCrashlytics: () => ({
        setCrashlyticsCollectionEnabled: vi.fn(),
        recordError: vi.fn(),
        log: vi.fn(),
    }),
}))

vi.mock('@react-native-firebase/messaging', () => ({
    getMessaging: () => ({
        registerDeviceForRemoteMessages: vi.fn(),
        onMessage: vi.fn(() => vi.fn()),
        getToken: vi.fn(async () => 'token'),
    }),
}))

vi.mock('@react-native-firebase/remote-config', () => ({
    getRemoteConfig: () => ({
        setDefaults: vi.fn(async () => {}),
        fetchAndActivate: vi.fn(async () => true),
        setConfigSettings: vi.fn(),
        getValue: vi.fn(() => ({
            asString: () => '',
            asBoolean: () => false,
            asNumber: () => 0,
        })),
    }),
}))

vi.mock('@notifee/react-native', () => ({
    default: {
        requestPermission: vi.fn(async () => true),
        onForegroundEvent: vi.fn(() => vi.fn()),
    },
    AuthorizationStatus: 'AUTHORIZED',
    notifee: {
        requestPermission: vi.fn(),
        createChannel: vi.fn(),
        displayNotification: vi.fn(),
        onForegroundEvent: vi.fn(),
    },
}))

vi.mock('react-native-mmkv', () => {
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

vi.mock('react-native-webview', () => {
    const React = require('react')
    const MockView = (props: any) =>
        React.createElement('div', props, props.children)
    return {
        default: vi.fn().mockImplementation(() => MockView),
        WebView: vi.fn().mockImplementation(() => MockView),
    }
})

// Mock Gesture Handler
vi.mock('react-native-gesture-handler', () => {
    const React = require('react')
    const MockView = (props: any) =>
        React.createElement('div', props, props.children)
    return {
        Swipeable: MockView,
        DrawerLayout: MockView,
        State: {},
        ScrollView: MockView,
        Slider: MockView,
        Switch: MockView,
        TextInput: MockView,
        ToolbarAndroid: MockView,
        ViewPagerAndroid: MockView,
        DrawerLayoutAndroid: MockView,
        WebView: MockView,
        NativeViewGestureHandler: MockView,
        TapGestureHandler: MockView,
        FlingGestureHandler: MockView,
        ForceTouchGestureHandler: MockView,
        LongPressGestureHandler: MockView,
        PanGestureHandler: MockView,
        PinchGestureHandler: MockView,
        RotationGestureHandler: MockView,
        /* Buttons */
        RawButton: MockView,
        BaseButton: MockView,
        RectButton: MockView,
        BorderlessButton: MockView,
        /* Other */
        FlatList: MockView,
        gestureHandlerRootHOC: vi.fn(),
        Directions: {},
    }
})

vi.mock('react-native-vector-icons/MaterialCommunityIcons', () => 'Icon')
vi.mock('react-native-vector-icons/Ionicons', () => 'Icon')
vi.mock('react-native-vector-icons/FontAwesome', () => 'Icon')
vi.mock('react-native-vector-icons/FontAwesome5', () => 'Icon')

vi.mock('@rneui/themed', () => {
    const React = require('react')

    // Create simple mock components using basic React elements only
    // Do NOT import from react-native here as that would trigger the Flow syntax error
    const MockView = ({ onPress, children, ...props }: any) =>
        React.createElement('div', { onClick: onPress, ...props }, children)
    const MockText = (props: any) =>
        React.createElement('span', props, props.children)
    const MockTextInput = ({ onChangeText, ...props }: any) =>
        React.createElement('input', {
            onChange: (e: any) => onChangeText?.(e.target.value),
            ...props,
        })

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
            xs: 4,
            sm: 8,
            md: 16,
            lg: 24,
            xl: 32,
            xxl: 36,
            '3xl': 48,
            '4xl': 56,
        },
        mode: 'light',
    }

    // Tab mock component with Item subcomponent
    const TabItem = (props: any) =>
        React.createElement(
            MockView,
            { ...props, 'data-testid': 'Tab.Item' },
            props.children,
        )
    const Tab = Object.assign(
        (props: any) =>
            React.createElement(
                MockView,
                { ...props, 'data-testid': 'Tab' },
                props.children,
            ),
        { Item: TabItem },
    )

    // Dialog mock component with subcomponents
    const DialogTitle = (props: any) =>
        React.createElement(
            MockText,
            { ...props, 'data-testid': 'Dialog.Title' },
            props.children,
        )
    const DialogButton = (props: any) =>
        React.createElement(
            MockView,
            {
                ...props,
                'data-testid': 'Dialog.Button',
                onClick: props.onPress,
            },
            props.title || props.children,
        )
    const DialogActions = (props: any) =>
        React.createElement(
            MockView,
            { ...props, 'data-testid': 'Dialog.Actions' },
            props.children,
        )
    const Dialog = Object.assign(
        ({ isVisible, children, ...props }: any) =>
            isVisible
                ? React.createElement(
                      MockView,
                      { ...props, 'data-testid': 'Dialog' },
                      children,
                  )
                : null,
        {
            Title: DialogTitle,
            Button: DialogButton,
            Actions: DialogActions,
        },
    )

    return {
        makeStyles: (styleFn: any) => (props: any) => {
            return styleFn(mockTheme, props) || {}
        },
        useTheme: () => ({ theme: mockTheme }),
        createTheme: () => mockTheme,
        ThemeProvider: ({ children }: any) => children,
        withTheme: (Component: any) => (props: any) =>
            React.createElement(Component, { ...props, theme: mockTheme }),

        // Mock Components using basic HTML elements
        Button: (props: any) =>
            React.createElement(
                MockView,
                props,
                props.title
                    ? React.createElement(MockText, null, props.title)
                    : props.children,
            ),
        Text: (props: any) =>
            React.createElement(MockText, props, props.children),
        Input: (props: any) =>
            React.createElement(MockTextInput, {
                ...props,
                'data-testid': 'RNEInput',
            }),
        Badge: ({ value, label, ...props }: any) =>
            React.createElement(
                MockText,
                { ...props, 'data-testid': 'RNEBadge' },
                value || label || props.children,
            ),
        Image: Object.assign(
            (props: any) =>
                React.createElement('img', {
                    ...props,
                    'data-testid': 'RNEImage',
                }),
            {
                resolveAssetSource: () => ({
                    uri: 'mock-image-uri',
                    width: 100,
                    height: 100,
                }),
            },
        ),
        Skeleton: (props: any) =>
            React.createElement('div', {
                ...props,
                'data-testid': 'RNESkeleton',
            }),
        CheckBox: (props: any) =>
            React.createElement(MockView, props, props.children),
        BottomSheet: ({ isVisible, children, ...props }: any) =>
            isVisible
                ? React.createElement(
                      MockView,
                      { ...props, 'data-testid': 'RNEBottomSheet' },
                      children,
                  )
                : null,
        Icon: (props: any) => React.createElement(MockView, props),
        Tab,
        TabView: Object.assign(
            (props: any) =>
                React.createElement(
                    MockView,
                    { ...props, 'data-testid': 'TabView' },
                    props.children,
                ),
            {
                Item: (props: any) =>
                    React.createElement(
                        MockView,
                        { ...props, 'data-testid': 'TabView.Item' },
                        props.children,
                    ),
            },
        ),
        Dialog,
        ListItem: Object.assign(
            (props: any) =>
                React.createElement(MockView, props, props.children),
            {
                Content: (props: any) =>
                    React.createElement(MockView, props, props.children),
                Title: (props: any) =>
                    React.createElement(MockText, props, props.children),
                Subtitle: (props: any) =>
                    React.createElement(MockText, props, props.children),
                Chevron: (props: any) => React.createElement(MockView, props),
            },
        ),
    }
})

vi.mock('react-native-notifier', () => {
    const React = require('react')
    const MockView = (props: any) =>
        React.createElement('div', props, props.children)
    return {
        NotifierRoot: ({ children }: any) =>
            React.createElement(MockView, {}, children),
        NotifierWrapper: ({ children }: any) =>
            React.createElement(MockView, {}, children),
        Notifier: {
            showNotification: vi.fn(),
            hideNotification: vi.fn(),
        },
    }
})

// Mock @react-native-clipboard/clipboard
vi.mock('@react-native-clipboard/clipboard', () => ({
    default: {
        setString: vi.fn(),
        getString: vi.fn(),
        hasString: vi.fn(),
    },
}))

// Mock @perawallet/wallet-core-shared
vi.mock('@perawallet/wallet-core-shared', () => ({
    logger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    },
    truncateAlgorandAddress: vi.fn(a => a),
    ALGO_EXPLORER_URL: 'https://explorer.perawallet.app',
    Networks: { mainnet: 'mainnet', testnet: 'testnet' },
    formatDatetime: vi.fn(d => String(d)),
    formatCurrency: vi.fn(
        (value, _decimals, currency) => `${currency || '$'}${value}`,
    ),
    formatWithUnits: vi.fn(value => String(value)),
    formatNumber: vi.fn(value => String(value)),
    AppError: class AppError extends Error {
        constructor(message: string) {
            super(message)
            this.name = 'AppError'
        }
    },
    ErrorSeverity: { LOW: 'low', MEDIUM: 'medium', HIGH: 'high' },
    ErrorCategory: { WALLETCONNECT: 'walletconnect', UI: 'ui' },
    ERROR_I18N_KEYS: {
        WALLETCONNECT_INVALID_SESSION: 'walletconnect_invalid_session',
        WALLETCONNECT_SIGN_REQUEST: 'walletconnect_sign_request',
        WALLETCONNECT_PERMISSION: 'walletconnect_permission',
        WALLETCONNECT_INVALID_NETWORK: 'walletconnect_invalid_network',
    },
    createLazyStore: vi.fn(createStore => ({
        useStore: vi.fn(),
        initStore: vi.fn(() => createStore()),
    })),
}))

// Mock @perawallet/wallet-core-walletconnect
vi.mock('@perawallet/wallet-core-walletconnect', () => ({
    useWalletConnect: vi.fn(() => ({ connections: [] })),
    useWalletConnectStore: vi.fn(),
    initWalletConnectStore: vi.fn(),
    AlgorandChainId: {
        MainNet: 'algorand:wGHE2Pwdvd7S12BL5FaOP20EGYesN73k',
        TestNet: 'algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDe',
    },
    AlgorandPermission: {
        TX_PERMISSION: 'algo_signTxn',
        DATA_PERMISSION: 'algo_signData',
    },
}))

vi.mock('@perawallet/wallet-core-swaps', () => ({
    useSwaps: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-polling', () => ({
    usePolling: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-kms', () => ({
    useKMS: vi.fn(),
    initKMSStore: vi.fn(),
}))

// Mock @perawallet/wallet-core-assets
vi.mock('@perawallet/wallet-core-assets', () => ({
    ALGO_ASSET_ID: '0',
    ALGO_ASSET: {
        assetId: '0',
        name: 'Algo',
        unitName: 'ALGO',
        decimals: 6,
        totalSupply: '10000000000000000000',
        creator: { address: '' },
        peraMetadata: { isDeleted: false, verificationTier: 'unverified' },
    },
    PeraAssetVerificationTier: {
        verified: 'verified',
        unverified: 'unverified',
        suspicious: 'suspicious',
    },
    useAssetPriceHistoryQuery: vi.fn(() => ({ data: [], isPending: false })),
    useAssetsQuery: vi.fn(() => ({ data: [], isPending: false })),
    useAssetFiatPricesQuery: vi.fn(() => ({
        data: new Map(),
        isPending: false,
    })),
    useSingleAssetDetailsQuery: vi.fn(() => ({ data: null, isPending: false })),
    useInvalidateAssetPrices: vi.fn(() => ({ invalidate: vi.fn() })),
    initAssetsStore: vi.fn(),
}))

// Mock @perawallet/wallet-core-settings
vi.mock('@perawallet/wallet-core-settings', () => {
    return {
        useSettings: vi.fn(() => ({
            theme: 'light',
            privacyMode: false,
            setPrivacyMode: vi.fn(),
            setTheme: vi.fn(),
        })),
        usePreferences: vi.fn(() => ({
            getPreference: vi.fn(),
            setPreference: vi.fn(),
        })),
    }
})

// Mock @perawallet/wallet-core-accounts
vi.mock('@perawallet/wallet-core-accounts', () => {
    return {
        useAllAccounts: vi.fn(() => []),
        useAccountBalancesQuery: vi.fn(() => ({ data: [], isPending: false })),
        useSelectedAccount: vi.fn(() => null),
        useSelectedAccountAddress: vi.fn(() => ({
            selectedAccountAddress: null,
            setSelectedAccountAddress: vi.fn(),
        })),
        useAccountBalancesHistoryQuery: vi.fn(() => ({
            data: [],
            isPending: false,
        })),
        useAccountsAssetsBalanceHistoryQuery: vi.fn(() => ({
            data: [],
            isPending: false,
        })),
        getAccountDisplayName: vi.fn(a => a?.name || ''),
        // Account type functions with actual implementations
        isLedgerAccount: vi.fn(
            (account: any) =>
                account?.type === 'hardware' &&
                account?.hardwareDetails?.manufacturer === 'ledger',
        ),
        isRekeyedAccount: vi.fn((account: any) => !!account?.rekeyAddress),
        isHDWalletAccount: vi.fn((account: any) => !!account?.hdWalletDetails),
        isAlgo25Account: vi.fn((account: any) => account?.type === 'algo25'),
        isWatchAccount: vi.fn((account: any) => account?.type === 'watch'),
        isMultisigAccount: vi.fn(
            (account: any) => account?.type === 'multisig',
        ),
        canSignWithAccount: vi.fn((account: any) => !!account?.canSign),
        useAccountAssetBalanceQuery: vi.fn(() => ({
            data: null,
            isPending: false,
        })),
        ALGO_ASSET_ID: '0',
    }
})

// Mock @perawallet/wallet-core-contacts
vi.mock('@perawallet/wallet-core-contacts', () => ({
    useContacts: vi.fn(() => ({
        contacts: [],
        findContacts: vi.fn(() => []),
        addContact: vi.fn(),
        removeContact: vi.fn(),
        updateContact: vi.fn(),
    })),
    useContactsStore: vi.fn(() => ({
        contacts: [],
        addContact: vi.fn(),
        removeContact: vi.fn(),
        updateContact: vi.fn(),
    })),
    initContactsStore: vi.fn(),
}))

// Mock @perawallet/wallet-core-currencies
vi.mock('@perawallet/wallet-core-currencies', () => ({
    useCurrency: vi.fn(() => ({
        preferredCurrency: 'USD',
        portfolioFiatValue: '0',
    })),
}))

// Mock @perawallet/wallet-core-blockchain
vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useAlgorandClient: vi.fn(),
    useSigningRequest: vi.fn(() => ({ addSignRequest: vi.fn() })),
    useTransactionEncoder: vi.fn(() => ({ encodeSignedTransaction: vi.fn() })),
    isValidAlgorandAddress: vi.fn(address => {
        if (!address) return false
        return new RegExp('^[0-9a-zA-Z]{58}$').test(address)
    }),
    encodeAlgorandAddress: vi.fn(() => 'MOCKADDRESS'),
    initBlockchainStore: vi.fn(),
}))

// Mock @perawallet/wallet-core-platform-integration
vi.mock('@perawallet/wallet-core-platform-integration', () => ({
    useID: vi.fn(() => 'id'),
    useDeviceID: vi.fn(() => 'device-id'),
    useDeviceInfoService: vi.fn(() => ({
        getDeviceLocale: vi.fn(() => 'en-US'),
        getAppVersion: vi.fn(() => '1.0.0'),
        getDevicePlatform: vi.fn(() => 'ios'),
        getDeviceModel: vi.fn(() => 'iPhone'),
        getUserAgent: vi.fn(() => 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)'),
    })),
    useNetwork: vi.fn(() => ({
        network: 'mainnet',
    })),
    useAnalyticsService: vi.fn(() => ({
        logEvent: vi.fn(),
    })),
    RemoteConfigDefaults: {
        welcome_message: 'Hello',
    },
    AnalyticsServiceContainerKey: 'AnalyticsService',
}))

// Mock react-native-advanced-input-mask
vi.mock('react-native-advanced-input-mask', () => {
    const React = require('react')
    return {
        MaskedTextInput: (props: any) =>
            React.createElement('input', {
                ...props,
                'data-testid': 'masked-text-input',
                type: 'text',
            }),
    }
})

// Mock common SVG files to avoid InvalidCharacterError and loading issues
vi.mock('@assets/icons/algo.svg', () => {
    const React = require('react')
    return {
        default: (props: any) =>
            React.createElement('div', {
                ...props,
                'data-testid': 'SvgIcon',
            }),
    }
})

vi.mock('@assets/icons/assets/algo.svg', () => {
    const React = require('react')
    return {
        default: (props: any) =>
            React.createElement('div', {
                ...props,
                'data-testid': 'SvgIcon',
            }),
    }
})

// Mock react-native-svg as simple components
vi.mock('react-native-svg', () => {
    const React = require('react')
    return {
        default: (props: any) =>
            React.createElement('svg', props, props.children),
        Svg: (props: any) => React.createElement('svg', props, props.children),
        Path: (props: any) =>
            React.createElement('path', props, props.children),
        Circle: (props: any) =>
            React.createElement('circle', props, props.children),
        Rect: (props: any) =>
            React.createElement('rect', props, props.children),
        G: (props: any) => React.createElement('g', props, props.children),
        Defs: (props: any) =>
            React.createElement('defs', props, props.children),
        ClipPath: (props: any) =>
            React.createElement('clipPath', props, props.children),
    }
})

// Mock react-native-qrcode-svg (contains JSX in .js files)
vi.mock('react-native-qrcode-svg', () => {
    const React = require('react')
    return {
        default: (props: any) =>
            React.createElement('svg', {
                ...props,
                'data-testid': 'QRCode',
            }),
    }
})

// Mock @shopify/flash-list
vi.mock('@shopify/flash-list', () => {
    const React = require('react')
    return {
        FlashList: ({ data, renderItem }: any) => {
            return React.createElement(
                'div',
                { 'data-testid': 'FlashList' },
                data?.map((item: any, index: number) =>
                    renderItem({ item, index }),
                ),
            )
        },
    }
})

vi.mock('react-native-gifted-charts', () => {
    const React = require('react')
    return {
        LineChart: (props: any) =>
            React.createElement('div', {
                ...props,
                'data-testid': 'LineChart',
            }),
        BarChart: (props: any) =>
            React.createElement('div', { ...props, 'data-testid': 'BarChart' }),
        PieChart: (props: any) =>
            React.createElement('div', { ...props, 'data-testid': 'PieChart' }),
    }
})

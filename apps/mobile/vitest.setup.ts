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
import { vi, afterEach } from 'vitest'
// import '@testing-library/jest-native/extend-expect'

const store = new Map<string, string>()

// Mock platform driver to prevent "No platform driver configured" errors
vi.mock('@perawallet/wallet-extension-platform-driver', () => ({
    WithPlatformExtension: () => ({
        analytics: {
            logEvent: vi.fn(),
            setUserId: vi.fn(),
            setUserProperty: vi.fn(),
        },
        biometrics: {
            getSupportedBiometricType: vi.fn().mockResolvedValue(null),
            checkBiometricsAvailable: vi.fn().mockResolvedValue(false),
            authenticate: vi.fn().mockResolvedValue(false),
        },
        crashReporting: {
            log: vi.fn(),
            recordError: vi.fn(),
        },
        deviceInfo: {
            getDevicePlatform: () => 'ios',
            getDeviceModel: () => 'iPhone',
            getDeviceId: () => 'test-device-id',
            getVersion: () => '1.0.0',
            getBuildNumber: () => '1',
            getDeviceLocale: () => 'en-US',
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
            fetchAndActivate: vi.fn().mockResolvedValue(true),
            getValue: vi.fn().mockReturnValue({ asString: () => '' }),
            getBoolean: vi.fn().mockReturnValue(false),
            getString: vi.fn().mockReturnValue(''),
        },
        secureStorage: {
            setItem: vi.fn().mockResolvedValue(undefined),
            getItem: vi.fn().mockResolvedValue(null),
            removeItem: vi.fn().mockResolvedValue(undefined),
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
        biometrics: {
            getSupportedBiometricType: vi.fn().mockResolvedValue(null),
            checkBiometricsAvailable: vi.fn().mockResolvedValue(false),
            authenticate: vi.fn().mockResolvedValue(false),
        },
        crashReporting: {
            log: vi.fn(),
            recordError: vi.fn(),
        },
        deviceInfo: {
            getDevicePlatform: () => 'ios',
            getDeviceModel: () => 'iPhone',
            getDeviceId: () => 'test-device-id',
            getVersion: () => '1.0.0',
            getBuildNumber: () => '1',
            getDeviceLocale: () => 'en-US',
            getDeviceLanguage: () => 'en',
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
        secureStorage: {
            setItem: vi.fn().mockResolvedValue(undefined),
            getItem: vi.fn().mockResolvedValue(null),
            removeItem: vi.fn().mockResolvedValue(undefined),
        },
        key: {
            store: {
                remove: vi.fn(),
                import: vi.fn(),
                sign: vi.fn(),
            },
        },
    }
    return {
        getProvider: () => providerValue,
        PeraWalletProvider: ({ children }: { children: React.ReactNode }) =>
            children,
        usePeraProvider: () => providerValue,
    }
})

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

// Mock expo-splash-screen
vi.mock('expo-splash-screen', () => ({
    preventAutoHideAsync: vi.fn().mockResolvedValue(true),
    hideAsync: vi.fn().mockResolvedValue(true),
}))

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
vi.mock('@components/core/PWIcon/PWIcon', () => {
    const React = require('react')
    return {
        PWIcon: ({ onPress, name, testID }: any) =>
            React.createElement('div', {
                onClick: onPress,
                role: onPress ? 'button' : undefined,
                'data-testid': testID || `icon-${name}`,
            }),
    }
})

// Mock @components/core barrel export with all core components
vi.mock('@components/core', () => {
    const React = require('react')

    // Helper to create mock components
    const createMockComponent =
        (name: string, elementType = 'div') =>
        ({ children, onPress, testID, style, isDisabled, ...props }: any) =>
            React.createElement(
                elementType,
                {
                    ...props,
                    style,
                    onClick: onPress,
                    disabled: isDisabled,
                    'data-testid': testID || name,
                },
                children,
            )

    return {
        PWBadge: ({ value, label, children, testID, ...props }: any) =>
            React.createElement(
                'span',
                { ...props, 'data-testid': testID || 'PWBadge' },
                value || label || children,
            ),
        PWBottomSheet: ({ isVisible, children, ...props }: any) =>
            isVisible
                ? React.createElement(
                      'div',
                      { ...props, 'data-testid': 'PWBottomSheet' },
                      children,
                  )
                : null,
        PWTouchableIcon: ({ name, onPress, testID, ...props }: any) =>
            React.createElement('div', {
                ...props,
                onClick: onPress,
                role: onPress ? 'button' : undefined,
                'data-testid': testID || `touchable-icon-${name}`,
            }),
        PWButton: ({
            children,
            title,
            onPress,
            testID,
            isDisabled,
            isLoading,
            ...props
        }: any) =>
            React.createElement(
                'button',
                {
                    ...props,
                    onClick: onPress,
                    disabled: isDisabled,
                    'data-testid': testID || 'PWButton',
                },
                isLoading
                    ? React.createElement('div', {
                          'data-testid': 'activity-indicator',
                      })
                    : title || children,
            ),
        PWCheckbox: createMockComponent('PWCheckbox'),
        PWChip: ({ label, title, children, testID, ...props }: any) =>
            React.createElement(
                'span',
                { ...props, 'data-testid': testID || 'PWChip' },
                title || label || children,
            ),
        PWDialog: ({ isVisible, children, ...props }: any) =>
            isVisible
                ? React.createElement(
                      'div',
                      { ...props, 'data-testid': 'PWDialog' },
                      children,
                  )
                : null,
        PWDivider: () =>
            React.createElement('hr', { 'data-testid': 'PWDivider' }),
        PWHeader: ({ title, children, testID, ...props }: any) =>
            React.createElement(
                'div',
                { ...props, 'data-testid': testID || 'PWHeader' },
                title && React.createElement('span', { key: 'title' }, title),
                children,
            ),
        PWFlatList: React.forwardRef(
            (
                {
                    data,
                    renderItem,
                    ListHeaderComponent,
                    ListFooterComponent,
                    ListEmptyComponent,
                    testID,
                    ...props
                }: any,
                ref: any,
            ) => {
                React.useImperativeHandle(ref, () => ({
                    scrollToOffset: () => {},
                    scrollToIndex: () => {},
                    scrollToEnd: () => {},
                }))
                return React.createElement(
                    'div',
                    { ...props, 'data-testid': testID || 'PWFlatList' },
                    typeof ListHeaderComponent === 'function'
                        ? React.createElement(ListHeaderComponent)
                        : ListHeaderComponent,
                    data && data.length > 0
                        ? data.map((item: any, index: number) =>
                              renderItem({ item, index }),
                          )
                        : typeof ListEmptyComponent === 'function'
                          ? React.createElement(ListEmptyComponent)
                          : ListEmptyComponent,
                    typeof ListFooterComponent === 'function'
                        ? React.createElement(ListFooterComponent)
                        : ListFooterComponent,
                )
            },
        ),
        PWIcon: ({ onPress, name, testID }: any) =>
            React.createElement('div', {
                onClick: onPress,
                role: onPress ? 'button' : undefined,
                'data-testid': testID || `icon-${name}`,
            }),
        PWImage: (props: any) =>
            React.createElement('img', { ...props, 'data-testid': 'PWImage' }),
        PWInfoView: ({
            illustration,
            title,
            body,
            footerExtras,
            primaryAction,
            secondaryAction,
            testID = 'pw-info-view',
        }: any) =>
            React.createElement(
                'div',
                { 'data-testid': testID },
                illustration,
                title && React.createElement('h1', { key: 'title' }, title),
                body && React.createElement('p', { key: 'body' }, body),
                footerExtras,
                primaryAction &&
                    React.createElement(
                        'button',
                        {
                            key: 'primary',
                            onClick: primaryAction.onPress,
                            disabled: primaryAction.isDisabled,
                            'data-testid':
                                primaryAction.testID ?? `${testID}-primary`,
                        },
                        primaryAction.label,
                    ),
                secondaryAction &&
                    React.createElement(
                        'button',
                        {
                            key: 'secondary',
                            onClick: secondaryAction.onPress,
                            disabled: secondaryAction.isDisabled,
                            'data-testid':
                                secondaryAction.testID ?? `${testID}-secondary`,
                        },
                        secondaryAction.label,
                    ),
            ),
        PWInput: ({ onChangeText, testID, ...props }: any) =>
            React.createElement('input', {
                ...props,
                onChange: (e: any) => onChangeText?.(e.target.value),
                'data-testid': testID || 'PWInput',
            }),
        PWListItem: ({
            title,
            subtitle,
            children,
            onPress,
            testID,
            ...props
        }: any) =>
            React.createElement(
                'div',
                {
                    ...props,
                    onClick: onPress,
                    'data-testid': testID || 'PWListItem',
                },
                title && React.createElement('span', { key: 'title' }, title),
                subtitle &&
                    React.createElement('span', { key: 'subtitle' }, subtitle),
                children,
            ),
        PWLoadingOverlay: ({ isVisible, title, children, ...props }: any) =>
            isVisible
                ? React.createElement(
                      'div',
                      { ...props, 'data-testid': 'PWLoadingOverlay' },
                      title &&
                          React.createElement('span', { key: 'title' }, title),
                      children,
                  )
                : null,
        PWNumpad: ({ mode, onKeyPress, isDisabled, testID }: any) => {
            const keys =
                mode === 'number'
                    ? [
                          '1',
                          '2',
                          '3',
                          '4',
                          '5',
                          '6',
                          '7',
                          '8',
                          '9',
                          '.',
                          '0',
                          'delete',
                      ]
                    : [
                          '1',
                          '2',
                          '3',
                          '4',
                          '5',
                          '6',
                          '7',
                          '8',
                          '9',
                          null,
                          '0',
                          'delete',
                      ]
            return React.createElement(
                'div',
                { 'data-testid': testID || 'PWNumpad' },
                keys
                    .filter((key): key is string => !!key)
                    .map(key =>
                        key === 'delete'
                            ? React.createElement('button', {
                                  key,
                                  onClick: () =>
                                      !isDisabled && onKeyPress?.('delete'),
                                  'data-testid': 'icon-delete',
                              })
                            : React.createElement(
                                  'button',
                                  {
                                      key,
                                      onClick: () =>
                                          !isDisabled && onKeyPress?.(key),
                                  },
                                  key,
                              ),
                    ),
            )
        },
        PWOverlay: ({ isVisible, children, ...props }: any) =>
            isVisible
                ? React.createElement(
                      'div',
                      { ...props, 'data-testid': 'PWOverlay' },
                      children,
                  )
                : null,
        PWPinCircles: createMockComponent('PWPinCircles'),
        PWRadioButton: createMockComponent('PWRadioButton'),
        PWRoundIcon: vi.fn(({ icon, size, testID, ...props }: any) =>
            React.createElement('div', {
                ...props,
                'data-testid': testID || `icon-${icon}`,
                'data-icon': icon,
                'data-size': size,
            }),
        ),
        PWScrollView: createMockComponent('PWScrollView'),
        PWSkeleton: createMockComponent('PWSkeleton'),
        PWSwitch: ({ value, onValueChange, testID, ...props }: any) =>
            React.createElement('input', {
                type: 'checkbox',
                role: 'switch',
                checked: value,
                onChange: (e: any) => onValueChange?.(e.target.checked),
                ...props,
                'data-testid': testID || 'PWSwitch',
            }),
        PWTabView: createMockComponent('PWTabView'),
        PWText: ({ children, onPress, testID, style, ...props }: any) =>
            React.createElement(
                'span',
                {
                    ...props,
                    style,
                    onClick: onPress,
                    'data-testid': testID || 'PWText',
                },
                children,
            ),
        PWToolbar: ({
            title,
            children,
            testID,
            left,
            center,
            right,
            ...props
        }: any) =>
            React.createElement(
                'div',
                { ...props, 'data-testid': testID || 'PWToolbar' },
                left,
                center ||
                    (title &&
                        React.createElement('span', { key: 'title' }, title)),
                children,
                right,
            ),
        PWTouchableOpacity: ({
            children,
            onPress,
            testID,
            isDisabled,
            disabled,
            ...props
        }: any) =>
            React.createElement(
                'button',
                {
                    ...props,
                    onClick: onPress,
                    role: 'button',
                    disabled: isDisabled ?? disabled,
                    'data-testid': testID || 'PWTouchableOpacity',
                    testid: testID || 'PWTouchableOpacity',
                },
                children,
            ),
        PWView: ({ children, testID, style, ...props }: any) =>
            React.createElement(
                'div',
                { ...props, style, 'data-testid': testID || 'PWView' },
                children,
            ),
        PWWebView: createMockComponent('PWWebView'),
        PWDropdown: ({ children, testID }: any) =>
            React.createElement(
                'div',
                { 'data-testid': testID || 'PWDropdown' },
                children,
            ),
        PWDropdownItem: createMockComponent('PWDropdownItem'),
        PWSwipeable: createMockComponent('PWSwipeable'),
        DEFAULT_SWIPE_ACTION_WIDTH: 80,
        PWSlideToConfirm: ({
            title,
            loadingTitle,
            onConfirm,
            isLoading,
            isDisabled,
            testID,
            ...props
        }: any) =>
            React.createElement(
                'button',
                {
                    ...props,
                    onClick: onConfirm,
                    disabled: isDisabled,
                    'data-testid': testID || 'PWSlideToConfirm',
                },
                isLoading
                    ? React.createElement('div', {
                          'data-testid': 'activity-indicator',
                      })
                    : title,
                isLoading && loadingTitle
                    ? React.createElement(
                          'span',
                          { key: 'loading' },
                          loadingTitle,
                      )
                    : null,
            ),
    }
})

// Clean up after each test
afterEach(() => {
    vi.clearAllMocks()
    store.clear()
})

vi.mock('expo-image', () => {
    const React = require('react')
    return {
        Image: (props: Record<string, unknown>) =>
            React.createElement('img', {
                ...props,
                'data-testid': props.testID || 'expo-image',
            }),
        ImageContentFit: {},
    }
})

vi.mock('expo-clipboard', () => ({
    setStringAsync: vi.fn(),
    getStringAsync: vi.fn(),
}))

vi.mock('expo-haptics', () => ({
    notificationAsync: vi.fn(),
    impactAsync: vi.fn(),
    selectionAsync: vi.fn(),
    NotificationFeedbackType: {
        Success: 'success',
        Warning: 'warning',
        Error: 'error',
    },
    ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
}))

vi.mock('expo-localization', () => ({
    getLocales: () => [{ languageTag: 'en-US', regionCode: 'US' }],
}))

vi.mock('expo-application', () => ({
    applicationName: 'Pera Wallet',
    applicationId: 'com.test.app',
    nativeApplicationVersion: '1.0.0',
    nativeBuildVersion: '1',
    getIosIdForVendorAsync: vi.fn(() => Promise.resolve('unique-device-id')),
    getAndroidId: vi.fn(() => 'unique-android-id'),
}))

vi.mock('expo-device', () => ({
    osVersion: '17.0',
    modelId: 'iPhone13,2',
    modelName: 'iPhone 13',
}))

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
                ({ onPress, children, activeOpacity, testID, ...props }) => {
                    const React = require('react')

                    void activeOpacity

                    return React.createElement(
                        'button',
                        {
                            ...props,
                            onClick: onPress,
                            ...(testID
                                ? { 'data-testid': testID, testid: testID }
                                : {}),
                        },
                        children,
                    )
                },
            ),
        KeyboardAvoidingView: vi
            .fn()
            .mockImplementation(({ testID, ...props }) =>
                require('react').createElement(
                    'div',
                    {
                        ...props,
                        ...(testID
                            ? { 'data-testid': testID, testid: testID }
                            : {}),
                    },
                    props.children,
                ),
            ),
        View: vi.fn().mockImplementation(({ testID, ...props }) =>
            require('react').createElement(
                'div',
                {
                    ...props,
                    ...(testID
                        ? { 'data-testid': testID, testid: testID }
                        : {}),
                },
                props.children,
            ),
        ),
        Text: vi.fn().mockImplementation(({ testID, ...props }) =>
            require('react').createElement(
                'span',
                {
                    ...props,
                    ...(testID
                        ? { 'data-testid': testID, testid: testID }
                        : {}),
                },
                props.children,
            ),
        ),
        Image: Object.assign(
            vi.fn().mockImplementation(({ testID, ...props }) =>
                require('react').createElement(
                    'img',
                    {
                        ...props,
                        ...(testID
                            ? { 'data-testid': testID, testid: testID }
                            : {}),
                    },
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
            vi.fn().mockImplementation(({ testID, ...props }) =>
                require('react').createElement(
                    'div',
                    {
                        ...props,
                        ...(testID
                            ? {
                                  'data-testid': testID || 'ImageBackground',
                                  testid: testID || 'ImageBackground',
                              }
                            : {
                                  'data-testid': 'ImageBackground',
                                  testid: 'ImageBackground',
                              }),
                    },
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
        ScrollView: vi.fn().mockImplementation(({ testID, ...props }) =>
            require('react').createElement(
                'div',
                {
                    ...props,
                    ...(testID
                        ? { 'data-testid': testID, testid: testID }
                        : {}),
                },
                props.children,
            ),
        ),
        FlatList: vi
            .fn()
            .mockImplementation(({ data, renderItem, testID, ...props }) => {
                const React = require('react')
                return React.createElement(
                    'div',
                    {
                        ...props,
                        'data-testid': testID || 'FlatList',
                        testid: testID || 'FlatList',
                    },
                    data?.map((item: any, index: number) =>
                        renderItem({ item, index }),
                    ),
                )
            }),
        SectionList: vi
            .fn()
            .mockImplementation(
                ({
                    sections,
                    renderItem,
                    renderSectionHeader,
                    keyExtractor,
                    testID,
                    ListHeaderComponent,
                    ListEmptyComponent,
                    ListFooterComponent,
                    ...props
                }) => {
                    const React = require('react')
                    const isEmpty =
                        !sections ||
                        sections.length === 0 ||
                        sections.every(
                            (s: any) => !s.data || s.data.length === 0,
                        )
                    return React.createElement(
                        'div',
                        {
                            ...props,
                            'data-testid': testID || 'SectionList',
                            testid: testID || 'SectionList',
                        },
                        ListHeaderComponent
                            ? typeof ListHeaderComponent === 'function'
                                ? ListHeaderComponent()
                                : ListHeaderComponent
                            : null,
                        isEmpty && ListEmptyComponent
                            ? typeof ListEmptyComponent === 'function'
                                ? ListEmptyComponent()
                                : ListEmptyComponent
                            : null,
                        sections?.map((section: any, sectionIndex: number) =>
                            React.createElement(
                                'div',
                                { key: `section-${sectionIndex}` },
                                renderSectionHeader
                                    ? renderSectionHeader({ section })
                                    : null,
                                section.data?.map(
                                    (item: any, itemIndex: number) =>
                                        React.createElement(
                                            'div',
                                            {
                                                key: keyExtractor
                                                    ? keyExtractor(
                                                          item,
                                                          itemIndex,
                                                      )
                                                    : itemIndex,
                                            },
                                            renderItem({
                                                item,
                                                index: itemIndex,
                                                section,
                                            }),
                                        ),
                                ),
                            ),
                        ),
                        ListFooterComponent
                            ? typeof ListFooterComponent === 'function'
                                ? ListFooterComponent()
                                : ListFooterComponent
                            : null,
                    )
                },
            ),
        TextInput: vi.fn().mockImplementation(({ testID, ...props }) =>
            require('react').createElement(
                'input',
                {
                    ...props,
                    ...(testID
                        ? { 'data-testid': testID, testid: testID }
                        : {}),
                },
                props.children,
            ),
        ),

        Modal: vi.fn().mockImplementation((args: any) => {
            const {
                visible,
                transparent,
                animationType,
                onRequestClose,
                onShow,
                testID,
                ...props
            } = args

            void transparent
            void animationType
            void onRequestClose
            void onShow
            return visible
                ? require('react').createElement(
                      'div',
                      {
                          ...props,
                          ...(testID
                              ? { 'data-testid': testID, testid: testID }
                              : {}),
                      },
                      props.children,
                  )
                : null
        }),
        ActivityIndicator: vi.fn().mockImplementation(({ testID, ...props }) =>
            require('react').createElement(
                'div',
                {
                    ...props,
                    'data-testid': testID || 'activity-indicator',
                    testid: testID || 'activity-indicator',
                },
                'Loading...',
            ),
        ),
        Pressable: vi
            .fn()
            .mockImplementation(({ onPress, testID, ...props }) => {
                const React = require('react')
                return React.createElement(
                    'button',
                    {
                        ...props,
                        onClick: onPress,
                        ...(testID
                            ? { 'data-testid': testID, testid: testID }
                            : {}),
                    },
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
            inOut: vi.fn(fn => fn),
            out: vi.fn(fn => fn),
            in: vi.fn(fn => fn),
            ease: vi.fn(),
            linear: vi.fn(),
            quad: vi.fn(),
            poly: vi.fn(() => vi.fn()),
            bezier: vi.fn(() => vi.fn()),
            circle: vi.fn(),
            sin: vi.fn(),
            exp: vi.fn(),
            elastic: vi.fn(() => vi.fn()),
            back: vi.fn(() => vi.fn()),
            bounce: vi.fn(),
        },
        Animated: {
            timing: vi.fn(() => ({ start: vi.fn(cb => cb?.()) })),
            spring: vi.fn(() => ({ start: vi.fn(cb => cb?.()) })),
            parallel: vi.fn(animations => ({
                start: vi.fn(cb => {
                    animations.forEach((a: any) => a.start())
                    cb?.()
                }),
            })),
            event: vi.fn(),
            Value: vi.fn(function (this: any) {
                this.setValue = vi.fn()
                this.interpolate = vi.fn(() => '0px')
            }),
            createAnimatedComponent: vi.fn(c => c),
            View: vi.fn(({ children, style, ...props }) =>
                require('react').createElement(
                    'div',
                    { ...props, style },
                    children,
                ),
            ),
            Text: vi.fn(({ children, style, ...props }) =>
                require('react').createElement(
                    'span',
                    { ...props, style },
                    children,
                ),
            ),
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
    const frame = { x: 0, y: 0, width: 375, height: 812 }
    return {
        SafeAreaProvider: vi
            .fn()
            .mockImplementation(({ children }) => children),
        SafeAreaConsumer: vi
            .fn()
            .mockImplementation(({ children }) => children(inset)),
        useSafeAreaInsets: vi.fn().mockImplementation(() => inset),
        useSafeAreaFrame: vi.fn().mockImplementation(() => frame),
        initialWindowMetrics: { insets: inset, frame },
    }
})

vi.mock('react-native-draggable-flatlist', () => {
    const { forwardRef } = require('react')
    return {
        __esModule: true,
        default: forwardRef(({ data, renderItem, keyExtractor }: any) => {
            return (data ?? []).map((item: any, index: number) => {
                const key = keyExtractor ? keyExtractor(item, index) : index
                return renderItem({
                    item,
                    getIndex: () => index,
                    drag: vi.fn(),
                    isActive: false,
                    key,
                })
            })
        }),
        ScaleDecorator: ({ children }: any) => children,
        NestableScrollContainer: ({ children }: any) => children,
        NestableDraggableFlatList: forwardRef(
            ({ data, renderItem, keyExtractor }: any) => {
                return (data ?? []).map((item: any, index: number) => {
                    const key = keyExtractor ? keyExtractor(item, index) : index
                    return renderItem({
                        item,
                        getIndex: () => index,
                        drag: vi.fn(),
                        isActive: false,
                        key,
                    })
                })
            },
        ),
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
        push: vi.fn(),
        canGoBack: vi.fn(() => false),
    }),
    useRoute: vi.fn(() => ({
        params: {},
    })),
    useFocusEffect: vi.fn(),
    NavigationContainer: ({ children }: any) => children,
    NavigationIndependentTree: ({ children }: any) => children,
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
    createNavigatorFactory: vi.fn(() => () => ({
        Navigator: ({ children }: any) => children,
        Screen: ({ children }: any) => children,
        Group: ({ children }: any) => children,
    })),
    useNavigationState: vi.fn(() => ({})),
    StackActions: {
        replace: vi.fn(),
        push: vi.fn(),
        pop: vi.fn(),
        popToTop: vi.fn(),
    },
    createNavigationContainerRef: () => ({
        navigate: vi.fn(),
        dispatch: vi.fn(),
        reset: vi.fn(),
        goBack: vi.fn(),
        isReady: vi.fn(() => true),
        current: null,
    }),
}))

vi.mock('@react-navigation/bottom-tabs', () => ({
    createBottomTabNavigator: vi.fn(() => ({
        Navigator: ({ children }: any) => children,
        Screen: ({ children }: any) => children,
    })),
}))

vi.mock('@react-navigation/native-stack', () => {
    const React = require('react')
    return {
        createNativeStackNavigator: vi.fn(() => ({
            Navigator: ({ children, initialRouteName }: any) => {
                // Find the initial screen and render it
                const screens = React.Children.toArray(children)
                const initialScreen =
                    screens.find(
                        (child: any) => child.props?.name === initialRouteName,
                    ) || screens[0]
                if (initialScreen?.props?.component) {
                    const Component = initialScreen.props.component
                    return React.createElement(
                        Component,
                        initialScreen.props.initialParams || {},
                    )
                }
                return children
            },
            Screen: ({
                children,
                component: Component,
                initialParams,
            }: any) => {
                if (Component) {
                    return React.createElement(Component, initialParams || {})
                }
                return children
            },
        })),
    }
})

vi.mock('@react-navigation/stack', () => {
    const React = require('react')
    return {
        createStackNavigator: vi.fn(() => ({
            Navigator: ({ children, initialRouteName }: any) => {
                // Find the initial screen and render it
                const screens = React.Children.toArray(children)
                const initialScreen =
                    screens.find(
                        (child: any) => child.props?.name === initialRouteName,
                    ) || screens[0]
                if (initialScreen?.props?.component) {
                    const Component = initialScreen.props.component
                    return React.createElement(
                        Component,
                        initialScreen.props.initialParams || {},
                    )
                }
                return children
            },
            Screen: ({
                children,
                component: Component,
                initialParams,
            }: any) => {
                if (Component) {
                    return React.createElement(Component, initialParams || {})
                }
                return children
            },
            Group: ({ children }: any) => children,
        })),
        TransitionPresets: {
            SlideFromRightIOS: {},
            ModalSlideFromBottomIOS: {},
            ModalPresentationIOS: {},
            FadeFromBottomAndroid: {},
            RevealFromBottomAndroid: {},
            ScaleFromCenterAndroid: {},
            DefaultTransition: {},
            ModalTransition: {},
        },
        CardStyleInterpolators: {
            forHorizontalIOS: vi.fn(),
            forVerticalIOS: vi.fn(),
            forModalPresentationIOS: vi.fn(),
            forFadeFromBottomAndroid: vi.fn(),
            forRevealFromBottomAndroid: vi.fn(),
            forScaleFromCenterAndroid: vi.fn(),
            forNoAnimation: vi.fn(),
        },
        HeaderStyleInterpolators: {
            forUIKit: vi.fn(),
            forFade: vi.fn(),
            forStatic: vi.fn(),
            forNoAnimation: vi.fn(),
        },
    }
})

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
    const createGestureBuilder = () => {
        const builder: any = {}
        const chainable = [
            'enabled',
            'minPointers',
            'maxPointers',
            'numberOfTaps',
            'onStart',
            'onUpdate',
            'onEnd',
            'onBegin',
            'onFinalize',
            'onTouchesDown',
            'onTouchesUp',
            'onChange',
            'minDistance',
            'activeOffsetX',
            'activeOffsetY',
            'failOffsetX',
            'failOffsetY',
            'simultaneousWithExternalGesture',
            'requireExternalGestureToFail',
        ]
        chainable.forEach(method => {
            builder[method] = () => builder
        })
        return builder
    }
    const Gesture = {
        Pan: createGestureBuilder,
        Tap: createGestureBuilder,
        Pinch: createGestureBuilder,
        LongPress: createGestureBuilder,
        Fling: createGestureBuilder,
        Rotation: createGestureBuilder,
        Native: createGestureBuilder,
        Manual: createGestureBuilder,
        Race: (...gestures: any[]) => gestures[0],
        Simultaneous: (...gestures: any[]) => gestures[0],
        Exclusive: (...gestures: any[]) => gestures[0],
    }
    return {
        Gesture,
        GestureDetector: ({ children }: any) => children,
        GestureHandlerRootView: MockView,
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
        RefreshControl: MockView,
    }
})

vi.mock('react-native-vector-icons/MaterialCommunityIcons', () => 'Icon')
vi.mock('react-native-vector-icons/Ionicons', () => 'Icon')
vi.mock('react-native-vector-icons/FontAwesome', () => 'Icon')
vi.mock('react-native-vector-icons/FontAwesome5', () => 'Icon')

vi.mock('react-native-tab-view', () => ({
    TabView: () => null,
    TabBar: () => null,
    SceneMap: () => null,
}))

vi.mock('@react-navigation/material-top-tabs', () => ({
    createMaterialTopTabNavigator: vi.fn(() => ({
        Navigator: ({ children }: any) =>
            require('react').createElement('div', {}, children),

        Screen: ({ children, component: Component, options }: any) => {
            const React = require('react')
            return React.createElement(
                'div',
                {},
                options?.title || options?.tabBarLabel
                    ? React.createElement(
                          'span',
                          {},
                          options.title || options.tabBarLabel,
                      )
                    : null,
                Component
                    ? React.createElement(Component)
                    : typeof children === 'function'
                      ? children({ navigation: {} })
                      : children,
            )
        },
    })),
}))

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
        zIndex: {
            base: 0,
            layer1: 10,
            layer2: 20,
            overlay1: 100,
            max: 10000,
        },
        borderRadius: {
            none: 0,
            xs: 4,
            sm: 8,
            md: 12,
            lg: 16,
            xl: 24,
            full: 999,
        },
        borders: {
            none: 0,
            sm: 1,
            md: 2,
        },
        mode: 'light',
        shadows: {
            sm: {
                shadowColor: '#000000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.05,
                shadowRadius: 4,
                elevation: 2,
            },
            md: {
                shadowColor: '#000000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.08,
                shadowRadius: 8,
                elevation: 4,
            },
        },
    }

    // Tab mock component with Item subcomponent
    const TabItem = (props: any) =>
        React.createElement(
            MockView,
            { ...props, 'data-testid': 'Tab.Item' },
            props.title,
            props.children,
        )
    const Tab = Object.assign(
        (props: any) =>
            React.createElement(
                MockView,
                { ...props, 'data-testid': 'Tab' },
                React.Children.map(
                    props.children,
                    (child: any, index: number) => {
                        return React.cloneElement(child, {
                            onPress: () => props.onChange?.(index),
                        })
                    },
                ),
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
        Switch: ({ value, onValueChange, ...props }: any) =>
            React.createElement('input', {
                type: 'checkbox',
                role: 'switch',
                checked: value,
                onChange: (e: any) => onValueChange?.(e.target.checked),
                ...props,
                'data-testid': 'RNESwitch',
            }),
        BottomSheet: ({ isVisible, children, ...props }: any) =>
            isVisible
                ? React.createElement(
                      MockView,
                      { ...props, 'data-testid': 'RNEBottomSheet' },
                      children,
                  )
                : null,
        Overlay: ({ isVisible, children, ...props }: any) =>
            isVisible
                ? React.createElement(
                      MockView,
                      { ...props, 'data-testid': 'RNEOverlay' },
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
        Divider: (props: any) =>
            React.createElement(MockView, {
                ...props,
                'data-testid': 'Divider',
            }),
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
    stripUrlScheme: vi.fn(url => url),
    DEFAULT_PRECISION: 6,
    ALGO_EXPLORER_URL: 'https://explorer.perawallet.app',
    Networks: { mainnet: 'mainnet', testnet: 'testnet' },
    formatDatetime: vi.fn(d => String(d)),
    formatRelativeTime: vi.fn(d => String(d)),
    formatCurrency: vi.fn(
        (value, _decimals, currency) => `${currency || '$'}${value}`,
    ),
    formatWithUnits: vi.fn(value => String(value)),
    formatNumber: vi.fn(value => String(value)),
    generateUniqueId: vi.fn(() => 'mock-uuid'),
    generateOrderedUniqueId: vi.fn(() => 'mock-time-uuid'),
    AppError: class AppError extends Error {
        constructor(message: string) {
            super(message)
            this.name = 'AppError'
        }
    },
    ErrorSeverity: { LOW: 'low', MEDIUM: 'medium', HIGH: 'high' },
    ErrorCategory: { WALLETCONNECT: 'walletconnect', UI: 'ui' },
    useClearAllData: vi.fn(() => vi.fn().mockResolvedValue(undefined)),
    registerStore: vi.fn(),
    clearAllStores: vi.fn(),
    resetStoreRegistry: vi.fn(),
    getStoreRegistry: vi.fn(() => []),
    createPersistStorage: () => ({
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {},
    }),
    buildPrismUrl: vi.fn((url: string, width: number) =>
        url ? `${url}?width=${width}&quality=70` : undefined,
    ),
    getInitials: vi.fn((label: string, maxLetters: number = 2) => {
        const words = label.trim().split(/\s+/)
        if (words.length >= maxLetters) {
            return words
                .slice(0, maxLetters)
                .map((w: string) => w[0])
                .join('')
                .toUpperCase()
        }
        if (words.length === 1 && words[0].length > 0) {
            return words[0][0].toUpperCase()
        }
        return '?'
    }),
    useDebouncedValue: <T>(value: T) => value,
}))

// Mock @perawallet/wallet-core-projects
vi.mock('@perawallet/wallet-core-projects', () => ({
    useProjectByUrlQuery: vi.fn(() => ({
        data: null,
        isLoading: false,
        isError: false,
        error: null,
    })),
    useApplicationQuery: vi.fn(() => ({
        data: null,
        isLoading: false,
        isError: false,
        error: null,
    })),
}))

// Mock @perawallet/wallet-core-walletconnect
vi.mock('@perawallet/wallet-core-walletconnect', () => ({
    useWalletConnect: vi.fn(() => ({ connections: [] })),
    useWalletConnectStore: vi.fn(),
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
    isSwappableAsset: vi.fn(() => true),
}))

vi.mock('@perawallet/wallet-core-polling', () => ({
    usePolling: vi.fn(),
    usePollingStore: {
        getState: vi.fn(() => ({
            lastRefreshedRound: null,
            setLastRefreshedRound: vi.fn(),
        })),
    },
    sendShouldRefreshRequest: vi.fn(() =>
        Promise.resolve({ refresh: false, round: null }),
    ),
}))

vi.mock('@perawallet/wallet-core-background', () => ({
    initializeSyncService: vi.fn(() => ({
        start: vi.fn(),
        stop: vi.fn(),
        isRunning: vi.fn(() => false),
    })),
    getSyncService: vi.fn(() => ({
        start: vi.fn(),
        stop: vi.fn(),
        isRunning: vi.fn(() => false),
    })),
}))

vi.mock('@perawallet/wallet-core-kms', () => ({
    useKMS: vi.fn(),
    uniformIntBelow: (max: number) =>
        max <= 0 ? 0 : Math.floor(Math.random() * max),
    pickDistinctIndexes: (count: number, poolSize: number) => {
        const effective = Math.min(Math.max(count, 0), poolSize)
        const pool = Array.from({ length: poolSize }, (_, i) => i)
        for (let i = pool.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1))
            ;[pool[i], pool[j]] = [pool[j], pool[i]]
        }
        return pool.slice(0, effective)
    },
    zeroBytes: (...buffers: Array<Uint8Array | null | undefined>) => {
        for (const buf of buffers) {
            if (buf) buf.fill(0)
        }
    },
}))

// Mock @perawallet/wallet-core-assets
vi.mock('@perawallet/wallet-core-assets', () => ({
    toWholeUnits: (value: number | bigint, asset: { decimals: number }) =>
        Number(value) / Math.pow(10, asset.decimals),
    isAlgoAsset: (assetId: string | number) => String(assetId) === '0',
    ALGO_ASSET_ID: '0',
    KNOWN_ASSET_IDS: {
        USDC: { mainnet: '31566704', testnet: '10458941' },
    },
    getKnownAssetId: vi.fn((key: string, network: string) => {
        const ids: Record<string, Record<string, string>> = {
            USDC: { mainnet: '31566704', testnet: '10458941' },
        }
        return ids[key]?.[network] ?? ''
    }),
    ALGO_ASSET: {
        assetId: '0',
        name: 'Algo',
        unitName: 'ALGO',
        decimals: 6,
        totalSupply: '10000000000000000000',
        creator: { address: '' },
        peraMetadata: {
            isDeleted: false,
            verificationTier: 'verified',
            type: 'algo',
        },
    },
    PeraAssetVerificationTier: {
        verified: 'verified',
        unverified: 'unverified',
        suspicious: 'suspicious',
    },
    useAssetPriceHistoryQuery: vi.fn(() => ({ data: [], isPending: false })),
    useAssetsQuery: vi.fn(() => ({ data: [], isPending: false })),
    useAssetPricesQuery: vi.fn(() => ({
        data: new Map(),
        isPending: false,
    })),
    useSingleAssetDetailsQuery: vi.fn(() => ({ data: null, isPending: false })),
    useInvalidateAssetPrices: vi.fn(() => ({ invalidate: vi.fn() })),
    useToggleAssetFavoriteMutation: vi.fn(() => ({
        toggleAssetFavorite: vi.fn(),
        isLoading: false,
        isError: false,
        error: null,
        isSuccess: false,
    })),
    useToggleAssetPriceAlertMutation: vi.fn(() => ({
        toggleAssetPriceAlert: vi.fn(),
        isLoading: false,
        isError: false,
        error: null,
        isSuccess: false,
    })),
    useAssetSearchQuery: vi.fn(() => ({
        results: [],
        isLoading: false,
        isError: false,
        isFetchingNextPage: false,
        hasNextPage: false,
        fetchNextPage: vi.fn(),
    })),
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
        useNotificationPreferences: vi.fn(() => ({
            disabledAccounts: [],
            setAccountEnabled: vi.fn(),
            isAccountEnabled: vi.fn(() => true),
        })),
    }
})

// Mock @perawallet/wallet-core-accounts
vi.mock('@perawallet/wallet-core-accounts', () => {
    return {
        useAllAccounts: vi.fn(() => []),
        useAccountDiscovery: vi.fn(() => ({
            discoverRekeyedAccounts: vi.fn(),
        })),
        useAccountBalancesQuery: vi.fn(() => ({ data: [], isPending: false })),
        useSelectedAccount: vi.fn(() => null),
        useSelectedAccountAddress: vi.fn(() => ({
            selectedAccountAddress: null,
            setSelectedAccountAddress: vi.fn(),
        })),
        useSetAccounts: vi.fn(() => ({
            setAccounts: vi.fn(),
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
        isHardwareWalletAccount: vi.fn(
            (account: any) => account?.type === 'hardware',
        ),
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
        hasSigningKeys: vi.fn((account: any) => !!account?.keyPairId),
        canSignWithAccount: vi.fn((account: any) => !!account?.keyPairId),
        useAccountAssetBalanceQuery: vi.fn(() => ({
            data: null,
            isPending: false,
        })),
        useFindAccountByAddress: vi.fn(() => null),
        useTransactionSigner: vi.fn(() => ({
            signTransactions: vi.fn().mockResolvedValue([]),
        })),
        useArbitraryDataSigner: vi.fn(() => ({
            signArbitraryData: vi.fn().mockResolvedValue([]),
        })),
        ALGO_ASSET_ID: '0',
        AccountTypes: {
            algo25: 'algo25',
            hdWallet: 'hdWallet',
            hardware: 'hardware',
            multisig: 'multisig',
            watch: 'watch',
        },
        useOwnedAssets: vi.fn(() => ({
            assets: [],
            isLoading: false,
        })),
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
}))

// Mock @perawallet/wallet-core-currencies
vi.mock('@perawallet/wallet-core-currencies', () => ({
    useCurrency: vi.fn(() => ({
        preferredCurrency: 'USD',
        portfolioPreferredValue: '0',
    })),
}))

// Mock @perawallet/wallet-core-blockchain
vi.mock('@perawallet/wallet-core-blockchain', () => ({
    MIN_TXN_FEE: 1_000n,
    useAlgorandClient: vi.fn(),
    useSigningRequest: vi.fn(() => ({ addSignRequest: vi.fn() })),
    useTransactionEncoder: vi.fn(() => ({ encodeSignedTransaction: vi.fn() })),
    isValidAlgorandAddress: vi.fn(address => {
        if (!address) return false
        return new RegExp('^[0-9a-zA-Z]{58}$').test(address)
    }),
    encodeAlgorandAddress: vi.fn(() => 'MOCKADDRESS'),
    useNetwork: vi.fn(() => ({
        network: 'mainnet',
    })),
    useNetworkStore: Object.assign(
        vi.fn(() => 'mainnet'),
        {
            getState: vi.fn(() => ({
                network: 'mainnet',
                setNetwork: vi.fn(),
                resetState: vi.fn(),
            })),
        },
    ),
}))

// Mock @perawallet/wallet-extension-platform
vi.mock('@perawallet/wallet-extension-platform', () => ({
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
        welcome_message: 'Hello',
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
        FlashList: ({
            data,
            renderItem,
            ListHeaderComponent,
            ListFooterComponent,
            ListEmptyComponent,
        }: any) => {
            const header = ListHeaderComponent
                ? React.isValidElement(ListHeaderComponent)
                    ? ListHeaderComponent
                    : typeof ListHeaderComponent === 'function'
                      ? React.createElement(ListHeaderComponent)
                      : null
                : null
            const footer = ListFooterComponent
                ? React.isValidElement(ListFooterComponent)
                    ? ListFooterComponent
                    : typeof ListFooterComponent === 'function'
                      ? React.createElement(ListFooterComponent)
                      : null
                : null
            const empty = ListEmptyComponent
                ? React.isValidElement(ListEmptyComponent)
                    ? ListEmptyComponent
                    : typeof ListEmptyComponent === 'function'
                      ? React.createElement(ListEmptyComponent)
                      : null
                : null

            return React.createElement(
                'div',
                { 'data-testid': 'FlashList' },
                header,
                data && data.length > 0
                    ? data.map((item: any, index: number) =>
                          renderItem({ item, index }),
                      )
                    : empty,
                footer,
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

// Mock @react-native-community/datetimepicker to prevent Rollup parse errors
vi.mock('@react-native-community/datetimepicker', () => {
    const React = require('react')
    return {
        default: (props: any) =>
            React.createElement('div', {
                ...props,
                'data-testid': props.testID || 'datetimepicker',
            }),
    }
})

// Mock @gorhom/bottom-sheet
vi.mock('@gorhom/bottom-sheet', () => {
    const React = require('react')

    const BottomSheetModal = React.forwardRef(
        ({ children, ...props }: any, ref: any) => {
            const [isOpen, setIsOpen] = React.useState(false)

            React.useImperativeHandle(ref, () => ({
                present: () => setIsOpen(true),
                dismiss: () => setIsOpen(false),
                snapToIndex: () => setIsOpen(true),
                close: () => setIsOpen(false),
                expand: () => setIsOpen(true),
                collapse: () => {},
                forceClose: () => setIsOpen(false),
            }))

            return isOpen
                ? React.createElement(
                      'div',
                      { ...props, 'data-testid': 'BottomSheetModal' },
                      children,
                  )
                : null
        },
    )

    const BottomSheet = React.forwardRef(
        ({ children, ...props }: any, ref: any) => {
            React.useImperativeHandle(ref, () => ({
                snapToIndex: vi.fn(),
                close: vi.fn(),
                expand: vi.fn(),
                collapse: vi.fn(),
                forceClose: vi.fn(),
            }))

            return React.createElement(
                'div',
                { ...props, 'data-testid': 'BottomSheet' },
                children,
            )
        },
    )

    return {
        default: BottomSheet,
        BottomSheet,
        BottomSheetModal,
        BottomSheetModalProvider: ({ children }: any) => children,
        BottomSheetBackdrop: (props: any) =>
            React.createElement('div', {
                ...props,
                'data-testid': 'BottomSheetBackdrop',
            }),
        BottomSheetScrollView: ({ children, ...props }: any) =>
            React.createElement('div', { ...props }, children),
        BottomSheetView: ({ children, ...props }: any) =>
            React.createElement('div', { ...props }, children),
        BottomSheetFlatList: ({ data, renderItem, ...props }: any) =>
            React.createElement(
                'div',
                props,
                data?.map((item: any, index: number) =>
                    renderItem({ item, index }),
                ),
            ),
        BottomSheetSectionList: ({ sections, renderItem, ...props }: any) =>
            React.createElement(
                'div',
                props,
                sections?.flatMap((section: any) =>
                    section.data?.map((item: any, index: number) =>
                        renderItem({ item, index, section }),
                    ),
                ),
            ),
        BottomSheetTextInput: (props: any) =>
            React.createElement('input', props),
        useBottomSheet: () => ({
            snapToIndex: vi.fn(),
            close: vi.fn(),
            expand: vi.fn(),
            collapse: vi.fn(),
        }),
        useBottomSheetModal: () => ({
            dismiss: vi.fn(),
            dismissAll: vi.fn(),
        }),
        useBottomSheetDynamicSnapPoints: () => ({
            animatedHandleHeight: { value: 0 },
            animatedSnapPoints: { value: ['100%'] },
            animatedContentHeight: { value: 0 },
            handleContentLayout: vi.fn(),
        }),
    }
})

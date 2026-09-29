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

// Native-only react-native APIs with no DOM behaviour. Both the unit stubs and
// the integration project's react-native-web module spread these, so specs
// can assert on Alert/Linking/AppState calls and Platform stays iOS in both.
export const createReactNativeApiMocks = () => {
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
        BackHandler: {
            addEventListener: vi.fn(() => ({ remove: vi.fn() })),
            removeEventListener: vi.fn(),
            exitApp: vi.fn(),
        },
        Appearance: {
            getColorScheme: vi.fn(() => 'light'),
            addChangeListener: vi.fn(),
            removeChangeListener: vi.fn(),
        },
        Linking: {
            openURL: vi.fn(),
            openSettings: vi.fn(),
            canOpenURL: vi.fn(),
            getInitialURL: vi.fn(),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
        },
        AppState: {
            currentState: 'active',
            // Real RN returns an `EmitterSubscription` with `.remove()`.
            // Default the mock to the same shape so consumers can call
            // `.remove()` in an effect cleanup without crashing.
            addEventListener: vi.fn(() => ({ remove: vi.fn() })),
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
        PixelRatio: {
            get: vi.fn(() => 1),
            getFontScale: vi.fn(() => 1),
            getPixelSizeForLayoutSize: vi.fn(size => size),
            roundToNearestPixel: vi.fn(size => size),
        },
    }
}

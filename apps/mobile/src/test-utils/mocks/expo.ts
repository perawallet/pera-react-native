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

// Mock expo-splash-screen
vi.mock('expo-splash-screen', () => ({
    preventAutoHideAsync: vi.fn().mockResolvedValue(true),
    hideAsync: vi.fn().mockResolvedValue(true),
}))

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

// `expo-video` is a native module: importing it under jsdom drags in
// `expo/src/winter/runtime` and crashes with `Cannot find module
// './ImportMetaRegistry'`. Stub the hook + view to the surface VideoPlayer
// uses (a settable player with play/pause and a placeholder view).
vi.mock('expo-video', () => {
    const React = require('react')
    return {
        useVideoPlayer: (
            _source: unknown,
            setup?: (player: Record<string, unknown>) => void,
        ) => {
            const player = {
                loop: false,
                muted: false,
                play: vi.fn(),
                pause: vi.fn(),
                replace: vi.fn(),
                release: vi.fn(),
            }
            setup?.(player)
            return player
        },
        VideoView: (props: Record<string, unknown>) =>
            React.createElement('video', {
                'data-testid': props.testID || 'expo-video',
            }),
    }
})

// `expo-media-library/legacy` is a native module: importing it under jsdom
// drags in `expo/src/winter/runtime` and crashes resolving
// `./ImportMetaRegistry`. Stub the surface CollectibleDetail uses (permission
// request + save). Defaults to granted so the save path can be exercised.
vi.mock('expo-media-library/legacy', () => ({
    requestPermissionsAsync: vi.fn().mockResolvedValue({ status: 'granted' }),
    saveToLibraryAsync: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('expo-clipboard', () => ({
    setStringAsync: vi.fn(),
    getStringAsync: vi.fn(),
}))

// `expo-modules-core` reads `__DEV__` at module-load time, which is undefined
// under jsdom, so any expo-* package importing it crashes on import.
//
// Side-effect: every unit test sees `__DEV__ === false`, so dev-only branches
// run as in a production build. A spec wanting the dev branch must set and
// restore the global itself.
;(globalThis as { __DEV__?: boolean }).__DEV__ = false

vi.mock('expo-screen-capture', () => ({
    preventScreenCaptureAsync: vi.fn().mockResolvedValue(undefined),
    allowScreenCaptureAsync: vi.fn().mockResolvedValue(undefined),
    addScreenshotListener: vi.fn(() => ({ remove: vi.fn() })),
    removeScreenshotListener: vi.fn(),
}))

// `expo-file-system` transitively imports `expo-modules-core`, which probes
// `__DEV__` at module init and crashes under jsdom. Stub the `File` class
// to the surface the ASB import screen actually uses (the static picker +
// the `.text()` reader).
vi.mock('expo-file-system', () => {
    class FileMock {
        name = 'mock-file.txt'
        async text() {
            return ''
        }
        static pickFileAsync = vi.fn(async () => ({
            result: new FileMock(),
            canceled: false,
        }))
    }
    return { File: FileMock }
})

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

vi.mock('expo-intent-launcher', () => ({
    startActivityAsync: vi.fn().mockResolvedValue({ resultCode: -1 }),
}))

vi.mock('expo-device', () => ({
    osVersion: '17.0',
    modelId: 'iPhone13,2',
    modelName: 'iPhone 13',
}))

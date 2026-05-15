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

/* eslint-disable @typescript-eslint/no-require-imports */
// `vi.mock` factories are hoisted to the top of the module — top-level
// imports aren't bound when they run. The SVG mocks below have to use
// `require('react')` for the same reason vitest.setup.ts does.

import { afterEach, vi } from 'vitest'

// Inherit every RN runtime, native module, navigation, and PW component mock
// from the unit setup. Integration tests need those — running real
// react-native, native firebase, etc. under jsdom would explode.
import './vitest.setup'

import { useBottomSheetStore } from './src/modules/bottom-sheet'

// The bottom-sheet store is a module-scoped zustand singleton — requests
// opened in one test will still be present when the next test starts.
// Reset it after each integration test so flows that count requests, or
// assert sheet visibility from a known clean slate, aren't poisoned by
// the previous case.
afterEach(() => {
    useBottomSheetStore.getState().resetState()
})

// jsdom installs its own `Uint8Array` constructor on `globalThis`. Node's
// `Buffer` extends node's `Uint8Array`, which is a *different* constructor
// — `buffer instanceof globalThis.Uint8Array` is false under jsdom, so any
// crypto code that hands a Buffer to a check like `@noble/hashes`'s
// `isBytes()` (used by `xhd-wallet-api`'s key derivation) throws
// "expected Uint8Array, got type=object". Aliasing the global to node's
// `Uint8Array` realigns the two so HD-wallet derivation works end-to-end
// in flow tests. Production code never hits this — it runs on
// react-native, where `Buffer` and `Uint8Array` already share a realm.
;(globalThis as { Uint8Array: typeof Uint8Array }).Uint8Array =
    Object.getPrototypeOf(Buffer.prototype).constructor as typeof Uint8Array

// ...but opt OUT of the heavyweight @perawallet/wallet-core-* package mocks.
// Integration tests exercise the real domain code end-to-end; the network
// layer is the only thing we mock (via MSW).
//
// Add a new package here when an integration test needs the real
// implementation. Keep `@perawallet/wallet-extension-*` mocks intact —
// platform-driver / provider hit MMKV, biometrics, secure storage etc. that
// only work on a real device.
vi.unmock('@perawallet/wallet-core-shared')
vi.unmock('@perawallet/wallet-core-currencies')
vi.unmock('@perawallet/wallet-core-assets')
vi.unmock('@perawallet/wallet-core-projects')
vi.unmock('@perawallet/wallet-core-walletconnect')
vi.unmock('@perawallet/wallet-core-swaps')
vi.unmock('@perawallet/wallet-core-polling')
vi.unmock('@perawallet/wallet-core-background')
vi.unmock('@perawallet/wallet-core-settings')
vi.unmock('@perawallet/wallet-core-contacts')

// The provider singleton + the KMS keystore now have working in-memory test
// implementations (apps/mobile/src/test-utils/{platform-driver-test,
// algorand-keystore-test}.ts), aliased in vitest.config.ts. Real provider /
// kms / accounts code can now run end-to-end against in-memory storage.
vi.unmock('@perawallet/wallet-extension-provider')
vi.unmock('@perawallet/wallet-core-kms')
vi.unmock('@perawallet/wallet-core-accounts')
vi.unmock('@perawallet/wallet-core-blockchain')

// Replace the unit-test navigator stubs with a real-ish stack-based test
// navigator (apps/mobile/src/test-utils/test-navigator.tsx). The unit mocks
// just render the initial screen; the test navigator maintains a stack and
// implements navigate / push / replace / goBack so flow tests can traverse
// screens. The bottom-tabs surface is rare in flow tests; keep the stub.
vi.mock('@react-navigation/native', async () => {
    const nav = await import('./src/test-utils/test-navigator')
    return nav
})

vi.mock('@react-navigation/native-stack', async () => {
    const nav = await import('./src/test-utils/test-navigator')
    return {
        createNativeStackNavigator: nav.createNativeStackNavigator,
    }
})

vi.mock('@react-navigation/stack', async () => {
    const nav = await import('./src/test-utils/test-navigator')
    return {
        createStackNavigator: nav.createNativeStackNavigator,
    }
})

// SVGs used by onboarding screens. svgr emits real React SVG components,
// but rendering them under jsdom triggers `InvalidCharacterError` on
// attributes whose value is a long data URL (jsdom tries to use it as an
// XML Name). vitest.setup.ts mocks the unit-tests' SVGs the same way; this
// list extends coverage to integration flows. The factory is duplicated
// per-call because `vi.mock` is hoisted to the top of the module — any
// reference to a top-level binding at hoist time is undefined.
vi.mock('@assets/images/key.svg', () => {
    const React = require('react')
    return {
        default: (props: Record<string, unknown>) =>
            React.createElement('div', { ...props, 'data-testid': 'SvgIcon' }),
    }
})
vi.mock('@assets/images/key-inverted.svg', () => {
    const React = require('react')
    return {
        default: (props: Record<string, unknown>) =>
            React.createElement('div', { ...props, 'data-testid': 'SvgIcon' }),
    }
})
vi.mock('@assets/images/eye.svg', () => {
    const React = require('react')
    return {
        default: (props: Record<string, unknown>) =>
            React.createElement('div', { ...props, 'data-testid': 'SvgIcon' }),
    }
})
vi.mock('@assets/images/eye-inverted.svg', () => {
    const React = require('react')
    return {
        default: (props: Record<string, unknown>) =>
            React.createElement('div', { ...props, 'data-testid': 'SvgIcon' }),
    }
})
// Check glyph rendered on the rekey success screens.
vi.mock('@assets/icons/check.svg', () => {
    const React = require('react')
    return {
        default: (props: Record<string, unknown>) =>
            React.createElement('div', { ...props, 'data-testid': 'SvgIcon' }),
    }
})

// `expo-modules-core` references the React-Native `__DEV__` global at
// module-load time (in `setUpJsLogger.fx.ts`). Under jsdom this is
// undefined, so any expo-* package that transitively imports
// expo-modules-core crashes during import. Defining the global here
// fixes the parse-time failure; deeper expo-modules-core surfaces
// (e.g. `globalThis.expo.EventEmitter`) still need their consumer
// packages (expo-video, expo-audio, ...) to be mocked individually.
;(globalThis as { __DEV__?: boolean }).__DEV__ = false

// expo-screen-capture's surface is intentionally stubbed (rather than
// run for real) because the only mobile consumer is
// `usePreventScreenCapture`, which has no behavior worth exercising in
// a jsdom test.
vi.mock('expo-screen-capture', () => ({
    preventScreenCaptureAsync: vi.fn().mockResolvedValue(undefined),
    allowScreenCaptureAsync: vi.fn().mockResolvedValue(undefined),
    addScreenshotListener: vi.fn(() => ({ remove: vi.fn() })),
    removeScreenshotListener: vi.fn(),
}))

// `lottie-react-native` ships Flow-typed source that vite's parser can't
// read. Replace with a no-op view so screens that show animations (e.g.
// TransactionProcessingScreen) mount cleanly under jsdom.
vi.mock('lottie-react-native', () => {
    const React = require('react')
    return {
        default: (props: Record<string, unknown>) =>
            React.createElement('div', {
                ...props,
                'data-testid': 'LottieView',
            }),
    }
})

// expo-video / expo-audio / expo-image transitively reach
// expo-modules-core's native `EventEmitter`/`SharedRef` surface, which
// only resolves under a real React-Native runtime. NFT detail screens
// use these via the MediaCarousel; replace the parts the screens read
// with no-op stubs.
vi.mock('expo-video', () => {
    const React = require('react')
    return {
        VideoView: (props: Record<string, unknown>) =>
            React.createElement('div', {
                ...props,
                'data-testid': 'VideoView',
            }),
        useVideoPlayer: () => ({
            play: () => {},
            pause: () => {},
            replace: () => {},
            release: () => {},
        }),
    }
})

vi.mock('expo-audio', () => ({
    useAudioPlayer: () => ({
        play: () => {},
        pause: () => {},
        release: () => {},
    }),
    AudioModule: { setAudioModeAsync: vi.fn() },
}))

vi.mock('expo-file-system', () => {
    // The ASB import screen uses the static `File.pickFileAsync` to surface
    // the native picker and then reads `.text()` on the returned instance.
    // Tests override the `pickFileAsync` vi.fn() per-case to supply backup
    // contents — see `__integration__/onboarding-import-asb.test.tsx`.
    class File {
        name = 'mock-file.txt'
        constructor(uri?: string) {
            if (typeof uri === 'string') this.name = uri
        }
        async text(): Promise<string> {
            return ''
        }
        async read(): Promise<string> {
            return ''
        }
        async write(_data: unknown): Promise<void> {}
        static pickFileAsync = vi.fn(async () => new File())
    }
    return {
        File,
        Paths: { document: '/test/document', cache: '/test/cache' },
        documentDirectory: '/test/document/',
        cacheDirectory: '/test/cache/',
    }
})

vi.mock('expo-media-library', () => ({
    requestPermissionsAsync: vi.fn().mockResolvedValue({ granted: true }),
    saveToLibraryAsync: vi.fn().mockResolvedValue(undefined),
    createAssetAsync: vi.fn().mockResolvedValue({ id: 'asset-id' }),
}))

// react-native-pager-view ships Flow-typed source the vite parser
// rejects. NFT detail screens reach it via MediaCarousel + the
// fullscreen viewer; replace with a passthrough container.
vi.mock('react-native-pager-view', () => {
    const React = require('react')
    return {
        default: React.forwardRef(
            (props: Record<string, unknown>, _ref: unknown) =>
                React.createElement(
                    'div',
                    { ...props, 'data-testid': 'PagerView' },
                    (props as { children?: unknown }).children,
                ),
        ),
    }
})

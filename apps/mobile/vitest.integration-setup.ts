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

/* eslint-disable @typescript-eslint/no-require-imports */
// `vi.mock` factories are hoisted to the top of the module — top-level
// imports aren't bound when they run. The SVG mocks below have to use
// `require('react')` for the same reason vitest.setup.ts does.

import { afterEach, beforeEach, vi } from 'vitest'

// Inherit every RN runtime, native module, navigation, and PW component mock
// from the unit setup. Integration tests need those — running real
// react-native, native firebase, etc. under jsdom would explode.
import './vitest.setup'

import { useBottomSheetStore } from './src/modules/bottom-sheet'

// The bottom-sheet store is a module-scoped singleton, so requests opened in one
// test survive into the next unless reset.
afterEach(() => {
    useBottomSheetStore.getState().resetState()
})

// jsdom installs its own `Uint8Array`, but node's `Buffer` extends node's — a
// different constructor — so `buffer instanceof globalThis.Uint8Array` is false
// and any `isBytes()` check (e.g. in xhd-wallet-api's derivation) throws.
// Aliasing the global realigns them. Production never hits this: on
// react-native the two already share a realm.
;(globalThis as { Uint8Array: typeof Uint8Array }).Uint8Array =
    Object.getPrototypeOf(Buffer.prototype).constructor as typeof Uint8Array

// ...but opt OUT of the wallet-core-* mocks: integration tests run the real
// domain code, and MSW is the only thing standing in.
//
// Keep the `wallet-extension-*` mocks — those hit MMKV, biometrics and secure
// storage, which only work on a real device.
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
vi.unmock('@perawallet/wallet-core-staking')

// Pre-accept the default terms version so its blocking sheet doesn't pop over
// unrelated onboarding tests. The literals mirror the app's constants without
// pulling app modules into the harness.
beforeEach(async () => {
    const { useSettingsStore } =
        await import('@perawallet/wallet-core-settings')
    useSettingsStore.getState().setPreference('acceptedTermsVersion', '1')
})

// The provider singleton + the KMS keystore now have working in-memory test
// implementations (apps/mobile/src/test-utils/{platform-driver-test,
// algorand-keystore-test}.ts), aliased in vitest.config.ts. Real provider /
// kms / accounts code can now run end-to-end against in-memory storage.
vi.unmock('@perawallet/wallet-extension-provider')
vi.unmock('@perawallet/wallet-core-kms')
vi.unmock('@perawallet/wallet-core-accounts')
vi.unmock('@perawallet/wallet-core-blockchain')
vi.unmock('@perawallet/wallet-core-age-gate')

// The send/swap pipelines fire a background task that awaits chain confirmation
// after submission returns. Against MSW that poll never resolves, so it logs
// late — and during worker teardown that surfaces as `EnvironmentTeardownError`
// and fails the run. Resolving immediately removes the race; no flow test wires
// an onConfirmed handler, so nothing else changes.
vi.mock('@algorandfoundation/algokit-utils', async () => {
    const actual = await vi.importActual<
        typeof import('@algorandfoundation/algokit-utils')
    >('@algorandfoundation/algokit-utils')
    return {
        ...actual,
        waitForConfirmation: vi.fn().mockResolvedValue(undefined),
    }
})

// The unit-test navigator stubs only render the initial screen, so swap in the
// stack-based test navigator that flow tests can actually traverse. Bottom-tabs
// is rare in flow tests, so its stub stays.
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

// svgr emits real React SVG components, but jsdom throws `InvalidCharacterError`
// on attributes holding a long data URL — it treats the value as an XML Name.
// The factory is duplicated per call because `vi.mock` is hoisted, so any
// top-level binding is undefined at that point.
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
// Shield glyph rendered on the ASB import info screen.
vi.mock('@assets/icons/shield-check.svg', () => {
    const React = require('react')
    return {
        default: (props: Record<string, unknown>) =>
            React.createElement('div', { ...props, 'data-testid': 'SvgIcon' }),
    }
})
vi.mock('@assets/icons/accounts/light/ledger-account.svg', () => {
    const React = require('react')
    return {
        default: (props: Record<string, unknown>) =>
            React.createElement('div', { ...props, 'data-testid': 'SvgIcon' }),
    }
})

// `expo-modules-core` reads `__DEV__` at module-load time, which is undefined
// under jsdom, so any expo-* package importing it crashes. This fixes the
// parse-time failure only — deeper surfaces like `globalThis.expo.EventEmitter`
// still need their consumer packages mocked individually.
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

// These reach expo-modules-core's native `EventEmitter`/`SharedRef`, which only
// resolves under a real React-Native runtime. NFT detail screens use them via
// MediaCarousel, so stub the parts those screens read.
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

// PWSlideToConfirm confirms via a gesture-handler pan and a reanimated worklet,
// neither of which fires under jsdom — the gesture mock makes `onEnd` a no-op.
// Flow tests only need to TRIGGER confirmation, so this keeps the same testID
// and calls `onConfirm` on click. The gesture mechanics have their own spec.
vi.mock('@components/core/PWSlideToConfirm', () => {
    const React = require('react')
    return {
        PWSlideToConfirm: ({
            title,
            onConfirm,
            isLoading,
            isDisabled,
            testID,
        }: {
            title?: string
            onConfirm?: () => void
            isLoading?: boolean
            isDisabled?: boolean
            testID?: string
        }) =>
            React.createElement(
                'button',
                {
                    'data-testid': testID,
                    disabled: !!isLoading || !!isDisabled,
                    onClick: () => {
                        if (!isLoading && !isDisabled) onConfirm?.()
                    },
                },
                title,
            ),
    }
})

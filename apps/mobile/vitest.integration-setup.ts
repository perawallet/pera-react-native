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

import { vi } from 'vitest'

// Inherit every RN runtime, native module, navigation, and PW component mock
// from the unit setup. Integration tests need those — running real
// react-native, native firebase, etc. under jsdom would explode.
import './vitest.setup'

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

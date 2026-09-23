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

import { webcrypto } from 'node:crypto'
import { vi } from 'vitest'

// In-memory keyValueStorage so importing @perawallet/wallet-core-accounts does
// not transitively pull in react-native-mmkv (not available under jsdom).
const kvStore = new Map<string, string>()

// None of these native modules have a loadable build outside a device
// runtime. `@perawallet/wallet-core-passkeys` pulls them in transitively
// (its default `subtle`, its native writer's keystore/Platform calls); a
// per-file `vi.mock` doesn't reliably win the race against this package's
// own dependency graph, so these live here instead — same fix `apps/mobile`
// already applies for the same packages.
// `subtle` is Node's real WebCrypto, not a stub: code paths that rely on
// `derivePasskeyMainKey`'s default (unpassed) `subtle` parameter need a
// working PBKDF2, not just an importable module.
vi.mock('react-native', () => ({ Platform: { OS: 'ios' } }))
vi.mock('react-native-quick-crypto', () => ({ subtle: webcrypto.subtle }))
vi.mock('react-native-quick-base64', () => ({}))
vi.mock('@algorandfoundation/react-native-keystore', () => ({
    readMasterKey: vi.fn(async () => new Uint8Array(32)),
    storage: { get: vi.fn(), set: vi.fn(), getString: vi.fn() },
}))

vi.mock('@perawallet/wallet-extension-provider', () => ({
    getProvider: () => ({
        keyValueStorage: {
            getItem: (key: string) => kvStore.get(key) ?? null,
            setItem: (key: string, value: string) => kvStore.set(key, value),
            removeItem: (key: string) => {
                kvStore.delete(key)
            },
        },
    }),
}))

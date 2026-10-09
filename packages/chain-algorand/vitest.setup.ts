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

import { vi, beforeEach } from 'vitest'
import { createChainRegistry } from '@perawallet/wallet-core-chain-contract'
// Patches BigInt.prototype.microAlgo() globally; the patch outlives a spec's own
// mock of algokit-utils, which the transaction builders rely on.
import '@algorandfoundation/algokit-utils'

// The Algorand runtime reaches the platform provider, whose storage is a
// native module that the test runtime cannot load.
const store = new Map<string, string>()

// The network store resolves its `network` shim through the chain registry.
const chains = createChainRegistry()

// Persisted state from one test would otherwise rehydrate into the next, e.g.
// a `setNetwork('testnet')` in test A is still in storage when test B
// re-imports the store.
beforeEach(() => {
    store.clear()
    chains.reset()
})

const keyValueStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
    removeItem: (key: string) => {
        store.delete(key)
    },
}

// The backup package reaches the passkeys native writer, which imports a
// module with no loadable build outside a device runtime.
vi.mock('@algorandfoundation/react-native-keystore', () => ({
    readMasterKey: vi.fn(async () => new Uint8Array(32)),
    storage: { get: vi.fn(), set: vi.fn(), getString: vi.fn() },
}))

vi.mock('@perawallet/wallet-extension-platform-driver', () => ({
    WithPlatformExtension: () => ({ keyValueStorage }),
    getPlatformServices: () => ({ keyValueStorage }),
}))

vi.mock('@perawallet/wallet-extension-provider', () => ({
    // Specs hold no keystore, so a scheme read falls back to custody.
    getKeystoreStore: () => ({ state: { keys: [] } }),
    getProvider: () => ({ keyValueStorage, chains }),
}))

// The signing dist is minified, which mangles the `constructor.name` its
// errors take their `name` from; name-matching specs must see the source classes.
vi.mock('@perawallet/wallet-core-signing', async importOriginal => ({
    ...(await importOriginal<object>()),
    ...(await import('../signing/src/pipeline/errors')),
}))

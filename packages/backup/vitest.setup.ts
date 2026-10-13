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
import { beforeEach, vi } from 'vitest'
import {
    createChainRegistry,
    type ChainDescriptor,
} from '@perawallet/wallet-core-chain-contract'
import { CLOUD_BACKUP_ONLY } from './src/__tests__/cloudBackupOnly'
import { testKeystore } from './src/__tests__/secp256k1TestKeyStore'

// In-memory keyValueStorage so importing @perawallet/wallet-core-accounts does
// not transitively pull in react-native-mmkv (not available under jsdom).
const kvStore = new Map<string, string>()

// A standalone account's secret format is read from its chain's descriptor, and
// whether a chain is backed up from its capabilities.
const chains = createChainRegistry()
beforeEach(() => {
    chains.reset()
    testKeystore.store = undefined
    chains.register(
        {
            id: 'algorand',
            signing: {
                schemes: ['ed25519'],
                derivationPaths: {},
                rawKeySchemes: [],
                standaloneSecret: 'mnemonic',
            },
        } as unknown as ChainDescriptor,
        CLOUD_BACKUP_ONLY,
    )
})

// The native writer in `@perawallet/wallet-core-passkeys` imports this module,
// which has no loadable build outside a device runtime. A per-file `vi.mock`
// doesn't reliably win the race against this package's own dependency graph,
// so it lives here instead.
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
        deviceInfo: { getDevicePlatform: () => 'ios' },
        chains,
        key: {
            get store() {
                return testKeystore.store
            },
        },
    }),
    getKeystoreStore: () => ({
        state: {
            get keys() {
                return testKeystore.store?.state.keys ?? []
            },
        },
    }),
    // Node's real WebCrypto, not a stub: `derivePasskeyMainKey` falls back to
    // it when no `subtle` is passed and needs a working PBKDF2.
    keystoreSubtle: webcrypto.subtle,
}))

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
import { createChainRegistry } from '@perawallet/wallet-core-chain-contract'
import { registerAlgorandChain } from './src/harness/registerAlgorandAccounts'
import { latestConformanceKeystoreStore } from './src/harness/keystore'

// The submission chokepoint (packages/chain-algorand/src/signing/submission) reaches
// `@perawallet/wallet-core-chain-algorand/blockchain`'s network/accounts stores for their
// persisted state, and those stores resolve storage through
// `getProvider().keyValueStorage`. The real provider pulls in RN-native
// modules (react-native-mmkv) that cannot load under Node, so — same as
// packages/signing's own vitest.setup.ts — swap in an in-memory stand-in.
// This mocks platform storage only; algod itself is never mocked.
// Hoisted: a persisted store built while this file's imports load (the real
// accounts store, in the store-migration project) reads storage then, and
// zustand silently drops persistence when that read throws.
const { store } = vi.hoisted(() => ({ store: new Map<string, string>() }))

// The real provider always carries a chain registry, and the network store
// resolves its `network` shim through it on every write.
const chains = createChainRegistry()
registerAlgorandChain(chains)

vi.mock('@perawallet/wallet-extension-provider', () => ({
    getProvider: () => ({
        // A getter for the same reason: `chains` exists only once the imports
        // have loaded, and storage-only callers must not touch it before then.
        get chains() {
            return chains
        },
        keyValueStorage: {
            getItem: (key: string) => store.get(key) ?? null,
            setItem: (key: string, value: string) => store.set(key, value),
            removeItem: (key: string) => {
                store.delete(key)
            },
        },
    }),
    // The suite's own keystore, so app code that reads public key metadata
    // sees its keys; before one exists a scheme read falls back to custody.
    getKeystoreStore: () => latestConformanceKeystoreStore(),
}))

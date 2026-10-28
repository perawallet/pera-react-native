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

import {
    createDefaultShims,
    createKeyStore,
    type KeyStore,
    type KeyStoreState,
} from '@algorandfoundation/keystore-core'
import { Store } from '@tanstack/store'
import { createMemoryDriver } from '@perawallet/conformance/harness/keystore'
import type { ChainKeyStore } from '@perawallet/wallet-core-chain-contract'
import { createKmsCore } from '@perawallet/wallet-core-kms/core/createKmsCore'
import { secp256k1Shim } from '@perawallet/wallet-extension-provider/keystore/shims/secp256k1'

export type ConformanceKeyStore = KeyStore<void> & {
    /** The reactive store kms reads key metadata from, as the provider's is. */
    store: Store<KeyStoreState>
}

export type EvmConformanceKeyStore = {
    keyStore: ConformanceKeyStore
    kms: ChainKeyStore
}

/**
 * The provider's keystore stack with only custody swapped: keystore-core over
 * the conformance memory driver, the engine's default shims plus the
 * provider's own secp256k1 shim, and the app's kms core on top, which runs
 * the same ACL and digest checks `kmsCore` does on device.
 */
export const createEvmConformanceKeyStore =
    async (): Promise<EvmConformanceKeyStore> => {
        const store = new Store<KeyStoreState>({ keys: [], status: 'idle' })
        const engine = createKeyStore<void>({
            driver: createMemoryDriver(),
            store,
            shims: async () => [
                ...(await createDefaultShims()),
                secp256k1Shim(),
            ],
        })
        await engine.ready
        const keyStore = Object.assign(engine, { store })
        const core = createKmsCore({
            keyStore: () => keyStore,
            keys: () => store.state.keys,
        })
        const kms: ChainKeyStore = {
            deriveFromSeed: core.deriveFromSeed,
            importRawKey: core.importRawKey,
            sign: core.sign,
        }
        return { keyStore, kms }
    }

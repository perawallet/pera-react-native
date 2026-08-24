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
    createKeyStore,
    type DriverMaterial,
    type Key,
    type KeyId,
    type KeyStore,
    type KeyStoreDriver,
    type KeyStoreState,
    KeyNotFoundError,
} from '@algorandfoundation/keystore-core'
import { Store } from '@tanstack/store'

export type ConformanceKeyStore = KeyStore<void> & {
    /**
     * The reactive store backing this keystore. Exposed so suites can assert on
     * `state.algorithms`: a shim whose optional binding failed to load is simply
     * absent, which would make every later suite vacuous rather than red.
     */
    store: Store<KeyStoreState>
}

const wipe = (value: DriverMaterial | undefined): void => {
    if (value?.kind === 'bytes') value.bytes.fill(0)
}

export const createMemoryDriver = (): KeyStoreDriver<void> => {
    const material = new Map<KeyId, DriverMaterial>()
    const meta = new Map<KeyId, Key>()

    return {
        capabilities: {
            // Byte-only, matching the RN Keychain driver: standard keys are
            // serialized to sealed bytes rather than held as CryptoKeys, which
            // is the path the app actually takes.
            nativeCryptoKey: false,
            interactiveUnlock: false,
            authFactors: [],
        },

        put: async (id, value) => {
            if (value.kind !== 'bytes') {
                material.set(id, value)
                return
            }
            // The orchestrator hands over a buffer it expects the driver to
            // seal and is free to wipe; copy before wiping it.
            material.set(id, {
                kind: 'bytes',
                bytes: Uint8Array.from(value.bytes),
            })
            value.bytes.fill(0)
        },

        use: async (id, _ctx, fn) => {
            const stored = material.get(id)
            if (!stored) throw new KeyNotFoundError(id)
            if (stored.kind !== 'bytes') return fn(stored)

            // A fresh copy per call, never the stored buffer: the Falcon and
            // XHD shims wipe whatever they are handed, so returning the same
            // reference twice yields one good signature and then garbage.
            const plaintext = Uint8Array.from(stored.bytes)
            try {
                return await fn({ kind: 'bytes', bytes: plaintext })
            } finally {
                plaintext.fill(0)
            }
        },

        remove: async id => {
            wipe(material.get(id))
            material.delete(id)
            meta.delete(id)
        },

        clear: async () => {
            material.forEach(wipe)
            material.clear()
            meta.clear()
        },

        putMeta: async key => {
            meta.set(key.id, key)
        },

        getMeta: async id => meta.get(id),

        listMeta: async () => [...meta.values()],
    }
}

/**
 * The app's shipped keystore is built on the React Native Keychain/MMKV driver,
 * which cannot load in Node. Swapping in an in-memory driver keeps the same
 * orchestrator and the same WASM Falcon / XHD / Algo25 shim stack the app signs
 * with — only custody of the sealed bytes differs — so the conformance suites
 * exercise the real cryptography headlessly.
 */
export const createConformanceKeyStore =
    async (): Promise<ConformanceKeyStore> => {
        const store = new Store<KeyStoreState>({ keys: [], status: 'idle' })
        const keyStore = createKeyStore<void>({
            driver: createMemoryDriver(),
            store,
        })
        await keyStore.ready

        return Object.assign(keyStore, { store })
    }

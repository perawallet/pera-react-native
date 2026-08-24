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

/** AES-256-GCM, the cipher the RN driver seals material with. */
const MASTER_KEY_ALGORITHM = { name: 'AES-GCM', length: 256 } as const

/** GCM's standard nonce length; a fresh one is drawn for every seal. */
const IV_BYTES = 12

const ENCODER = new TextEncoder()
const DECODER = new TextDecoder()

type SealedMaterial = {
    iv: Uint8Array
    ciphertext: ArrayBuffer
}

export const createMemoryDriver = (): KeyStoreDriver<void> => {
    const material = new Map<KeyId, SealedMaterial>()
    const meta = new Map<KeyId, Key>()

    // The in-memory stand-in for the RN driver's Keychain-held master key:
    // non-extractable, unreachable outside this closure, and gone with the
    // process. Every record is sealed under it and opened just-in-time.
    const masterKey = crypto.subtle.generateKey(MASTER_KEY_ALGORITHM, false, [
        'encrypt',
        'decrypt',
    ])

    return {
        capabilities: {
            // Byte-only, matching the RN Keychain driver: standard keys are
            // serialized to sealed bytes rather than held as CryptoKeys, which
            // is the path the app actually takes.
            nativeCryptoKey: false,
            interactiveUnlock: false,
            authFactors: [],
        },

        ready: masterKey.then(() => undefined),

        put: async (id, value) => {
            if (value.kind !== 'bytes') {
                throw new Error(
                    'the conformance memory driver cannot persist a CryptoKey; expected bytes',
                )
            }
            const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES))
            // Sealing the base64 *text* rather than the raw bytes mirrors the RN
            // driver, so a payload its base64 round trip would mangle is mangled
            // here too instead of slipping through on a shortcut.
            const payload = ENCODER.encode(
                Buffer.from(value.bytes).toString('base64'),
            )
            const ciphertext = await crypto.subtle.encrypt(
                { name: 'AES-GCM', iv },
                await masterKey,
                payload,
            )
            payload.fill(0)
            material.set(id, { iv, ciphertext })
            // The orchestrator hands over a buffer it expects the driver to seal
            // and is then free to wipe.
            value.bytes.fill(0)
        },

        use: async (id, _ctx, fn) => {
            const sealed = material.get(id)
            if (!sealed) throw new KeyNotFoundError(id)

            // Opened afresh on every call, never cached: the Falcon and XHD
            // shims wipe whatever buffer they are handed, so a reused plaintext
            // signs correctly once and then emits garbage from an all-zero key.
            const opened = new Uint8Array(
                await crypto.subtle.decrypt(
                    { name: 'AES-GCM', iv: sealed.iv },
                    await masterKey,
                    sealed.ciphertext,
                ),
            )
            const bytes = new Uint8Array(
                Buffer.from(DECODER.decode(opened), 'base64'),
            )
            opened.fill(0)

            try {
                return await fn({ kind: 'bytes', bytes })
            } finally {
                bytes.fill(0)
            }
        },

        remove: async id => {
            material.delete(id)
            meta.delete(id)
        },

        clear: async () => {
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

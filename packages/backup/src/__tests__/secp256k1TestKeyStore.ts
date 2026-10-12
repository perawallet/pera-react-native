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

import * as secp from '@noble/secp256k1'
import { hmac } from '@noble/hashes/hmac.js'
import { sha256 } from '@noble/hashes/sha2.js'

// Loose local shapes, as `algorand-keystore-test.ts` does: the keystore's own
// types are transitive dependencies this package doesn't list.
export type TestKey = {
    id: string
    type: string
    publicKey?: Uint8Array
    [field: string]: unknown
}
type TestKeyData = TestKey & { privateKey?: Uint8Array }

export type TestKeyStore = {
    state: { keys: TestKey[] }
    import: (key: TestKeyData, format: string) => Promise<string>
    export: (id: string) => Promise<{ privateKey: Uint8Array }>
    sign: (id: string, digest: Uint8Array) => Promise<Uint8Array>
    remove: (id: string) => Promise<void>
}

/** What `vitest.setup.ts` hands to `getProvider().key.store` and `getKeystoreStore()`. */
export const testKeystore: { store?: TestKeyStore } = {}

secp.hashes.sha256 = sha256
secp.hashes.hmacSha256 = (key, message) => hmac(sha256, key, message)

// Copied from the provider's secp256k1 shim, which isn't exported: RFC 6979,
// low-s, `r‖s‖recovery`.
const signRecoverable = (
    privateKey: Uint8Array,
    digest: Uint8Array,
): Uint8Array => {
    const recovered = secp.sign(digest, privateKey, {
        prehash: false,
        lowS: true,
        format: 'recovered',
    })
    const out = new Uint8Array(65)
    out.set(recovered.subarray(1), 0)
    out[64] = recovered[0]
    return out
}

/** Real secp256k1 keys and ECDSA over an in-memory map, so a restore can be checked by what the restored key signs. */
export const createSecp256k1TestKeyStore = (
    keys: TestKey[] = [],
): TestKeyStore => {
    const privateKeys = new Map<string, Uint8Array>()
    const store: TestKeyStore = {
        state: { keys: [...keys] },
        import: async key => {
            if (!key.privateKey) throw new Error('A key import needs bytes')
            privateKeys.set(key.id, Uint8Array.from(key.privateKey))
            const { privateKey, ...entry } = key
            store.state.keys = [
                ...store.state.keys,
                { ...entry, publicKey: secp.getPublicKey(privateKey, false) },
            ]
            return key.id
        },
        export: async id => {
            const privateKey = privateKeys.get(id)
            if (!privateKey) throw new Error(`No key ${id}`)
            return { privateKey: Uint8Array.from(privateKey) }
        },
        sign: async (id, digest) => {
            const privateKey = privateKeys.get(id)
            if (!privateKey) throw new Error(`No key ${id}`)
            return signRecoverable(privateKey, digest)
        },
        remove: async id => {
            privateKeys.delete(id)
            store.state.keys = store.state.keys.filter(key => key.id !== id)
        },
    }
    return store
}

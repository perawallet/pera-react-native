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
// New tests written for this port. Upstream's store.test.ts
// (@algorandfoundation/keystore@1.0.0-canary.17) covers only the
// store-management half of store.ts (addKey/removeKey/setStatus/
// clearKeyStore/getKey/initializeKeyStore) — it has zero cases for
// encrypt/decrypt/sign/verify, so this suite is original to this repo.

import { Store } from '@tanstack/store'
import { describe, expect, it } from 'vitest'
import {
    generateKey,
    generateSeedData,
    generateXHDRootKeyFromSeed,
} from '../generate'
import { decrypt, encrypt, sign, verify } from '../state'
import type {
    KeyData,
    KeyStoreState,
    SeedData,
    XHDDerivedKeyData,
    XHDRootKey,
} from '../types'

describe('state.ts crypto entry points', () => {
    const createStore = () =>
        new Store<KeyStoreState>({
            keys: [],
            status: 'idle',
        })

    const makeUint8 = (arr: number[]) => new Uint8Array(arr)

    // Records every status value the store passes through, in order, so
    // assertions on the transition sequence can't be satisfied by a stub
    // that only sets 'idle' at the end (or never touches status at all).
    function trackStatuses(store: Store<KeyStoreState>): string[] {
        const seen: string[] = [store.state.status]
        store.subscribe(() => {
            seen.push(store.state.status)
        })
        return seen
    }

    async function setupEd25519Key() {
        const seedData = (await generateSeedData({ strength: 128 })) as SeedData

        const rootKey = await generateXHDRootKeyFromSeed({
            ...seedData,
            privateKey: new Uint8Array(seedData.privateKey as Uint8Array),
        })

        const edKey = (await generateKey({
            keyData: {
                type: 'hd-derived-ed25519',
                algorithm: 'EdDSA',
                metadata: {
                    account: 0,
                    index: 0,
                    context: 0,
                    parentKeyId: rootKey.id,
                },
            },
            parentKey: {
                ...rootKey,
                privateKey: new Uint8Array(rootKey.privateKey as Uint8Array),
            },
        })) as XHDDerivedKeyData

        return { rootKey, edKey }
    }

    describe('encrypt', () => {
        it('encrypts data against a key produced by generateKey', async () => {
            const store = createStore()
            const { edKey } = await setupEd25519Key()
            const data = makeUint8([1, 2, 3, 4])

            const ciphertext = await encrypt({
                store,
                key: {
                    ...edKey,
                    publicKey: new Uint8Array(edKey.publicKey as Uint8Array),
                },
                data,
            })

            expect(ciphertext).toBeInstanceOf(Uint8Array)
            expect(ciphertext).not.toEqual(data)
        })

        it('transitions status to encrypting then back to idle in a finally', async () => {
            const store = createStore()
            const { edKey } = await setupEd25519Key()
            const seen = trackStatuses(store)

            await encrypt({
                store,
                key: {
                    ...edKey,
                    publicKey: new Uint8Array(edKey.publicKey as Uint8Array),
                },
                data: makeUint8([1]),
            })

            expect(seen).toEqual(['idle', 'encrypting', 'idle'])
        })

        it('resets status to idle even when the key has no public key', async () => {
            const store = createStore()
            const seen = trackStatuses(store)
            const badKey = {
                id: 'k1',
                type: 'ecc',
                algorithm: 'raw',
            } as KeyData

            await expect(
                encrypt({ store, key: badKey, data: makeUint8([1]) }),
            ).rejects.toThrow('Key does not have a public key')

            expect(seen).toEqual(['idle', 'encrypting', 'idle'])
        })
    })

    describe('decrypt', () => {
        it('round trips: decrypt(encrypt(x)) === x', async () => {
            const store = createStore()
            const { edKey } = await setupEd25519Key()
            const data = makeUint8([9, 8, 7, 6, 5])

            // encryptWithKeyData/decryptWithKeyData derive their symmetric
            // key from publicKey alone, so the same publicKey round-trips
            // even though `encrypt` clears privateKey on the way out.
            const ciphertext = await encrypt({
                store,
                key: {
                    ...edKey,
                    publicKey: new Uint8Array(edKey.publicKey as Uint8Array),
                },
                data,
            })

            const plaintext = await decrypt({
                store,
                key: {
                    ...edKey,
                    publicKey: new Uint8Array(edKey.publicKey as Uint8Array),
                },
                data: ciphertext,
            })

            expect(plaintext).toEqual(data)
        })

        it('transitions status to decrypting then back to idle in a finally', async () => {
            const store = createStore()
            const { edKey } = await setupEd25519Key()
            const data = makeUint8([1, 2])

            const ciphertext = await encrypt({
                store,
                key: {
                    ...edKey,
                    publicKey: new Uint8Array(edKey.publicKey as Uint8Array),
                },
                data,
            })

            const seen = trackStatuses(store)
            await decrypt({
                store,
                key: {
                    ...edKey,
                    publicKey: new Uint8Array(edKey.publicKey as Uint8Array),
                },
                data: ciphertext,
            })

            expect(seen).toEqual(['idle', 'decrypting', 'idle'])
        })
    })

    describe('sign', () => {
        it('signs data against an HD-derived Ed25519 key produced by generateKey', async () => {
            const store = createStore()
            const { rootKey, edKey } = await setupEd25519Key()
            const data = makeUint8([1, 2, 3])

            const signature = await sign({
                store,
                key: edKey,
                parentKey: rootKey,
                data,
            })

            expect(signature).toBeInstanceOf(Uint8Array)
            expect(signature.length).toBe(64)
        })

        it('transitions status to signing then back to idle in a finally, and clears key + parentKey', async () => {
            const store = createStore()
            const { rootKey, edKey } = await setupEd25519Key()
            const seen = trackStatuses(store)

            await sign({
                store,
                key: edKey,
                parentKey: rootKey,
                data: makeUint8([1]),
            })

            expect(seen).toEqual(['idle', 'signing', 'idle'])
            // signWithKeyData's finally clears both key and parentKey private
            // material; `sign` additionally re-clears both defensively.
            expect(rootKey.privateKey).toBeUndefined()
        })

        it('resets status to idle even when signing throws', async () => {
            const store = createStore()
            const seen = trackStatuses(store)
            const key = {
                id: 'k1',
                type: 'secret-key',
                algorithm: 'raw',
                privateKey: makeUint8([1, 2, 3]),
            } as KeyData

            await expect(
                sign({ store, key, data: makeUint8([1]) }),
            ).rejects.toThrow('cannot be used to sign')

            expect(seen).toEqual(['idle', 'signing', 'idle'])
        })
    })

    describe('verify', () => {
        it('round trips true for EdDSA: verify(sign(x)) === true', async () => {
            const store = createStore()
            const { rootKey, edKey } = await setupEd25519Key()
            const data = makeUint8([4, 5, 6])

            const signature = await sign({
                store,
                key: {
                    ...edKey,
                    publicKey: new Uint8Array(edKey.publicKey as Uint8Array),
                },
                parentKey: rootKey,
                data,
            })

            const ok = await verify({
                store,
                key: edKey,
                data,
                signature,
            })

            expect(ok).toBe(true)
        })

        it('transitions status to verifying then back to idle in a finally', async () => {
            const store = createStore()
            const { rootKey, edKey } = await setupEd25519Key()
            const data = makeUint8([1])

            const signature = await sign({
                store,
                key: {
                    ...edKey,
                    publicKey: new Uint8Array(edKey.publicKey as Uint8Array),
                },
                parentKey: rootKey,
                data,
            })

            const seen = trackStatuses(store)
            await verify({ store, key: edKey, data, signature })

            expect(seen).toEqual(['idle', 'verifying', 'idle'])
        })

        it('P-256: verify(sign(x)) === false — sign.ts signs a raw digest with no internal hashing while verify.ts hashes via crypto.subtle.verify({hash:"SHA-256"}), so the halves never agree on the same message; see task-7-report.md HANDOFF TO TASK 8 and src/webauthn/keystore-signer.ts:258-269 for the documented workaround on the signing side', async () => {
            const store = createStore()
            const seedData = (await generateSeedData({
                strength: 128,
            })) as SeedData
            const rootKey = (await generateXHDRootKeyFromSeed({
                ...seedData,
                privateKey: new Uint8Array(seedData.privateKey as Uint8Array),
            })) as XHDRootKey

            const p256Key = await generateKey({
                keyData: {
                    type: 'hd-derived-p256',
                    algorithm: 'P256',
                    metadata: {
                        origin: 'https://example.com',
                        userHandle: 'user',
                        parentKeyId: rootKey.id,
                    },
                },
                parentKey: {
                    ...rootKey,
                    privateKey: new Uint8Array(
                        rootKey.privateKey as Uint8Array,
                    ),
                },
            })
            const publicKey = new Uint8Array(p256Key.publicKey as Uint8Array)

            const rootKey2 = (await generateXHDRootKeyFromSeed({
                ...seedData,
                privateKey: new Uint8Array(seedData.privateKey as Uint8Array),
            })) as XHDRootKey
            ;(rootKey2 as { id: string }).id = rootKey.id

            const data = makeUint8([1, 2, 3, 4])
            const signature = await sign({
                store,
                key: { ...p256Key, publicKey: new Uint8Array(publicKey) },
                parentKey: rootKey2,
                data,
            })

            const ok = await verify({
                store,
                key: {
                    ...p256Key,
                    publicKey: new Uint8Array(publicKey),
                } as KeyData,
                data,
                signature,
            })

            expect(ok).toBe(false)
        })
    })
})

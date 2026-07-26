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

import { Store } from '@tanstack/store'
import type { KeyStoreState } from '@algorandfoundation/keystore'
import { beforeEach, describe, expect, it } from 'vitest'
import {
    b64urlToBytes,
    bytesToB64url,
    deriveCredentialId,
} from '@perawallet/wallet-core-passkeys/webauthn'
import { createChromeFake, type ChromeFake } from '../../test-utils/chrome'
import { createVault } from '../../vault/vault'
import { hydrateKeystoreStorage, storage } from '../../storage/chrome-storage'
import { importSeed } from '../../store'
import { createKeystoreSigner } from '../keystore-signer'

/** Imports a P-256 raw public key (65-byte 0x04||X||Y) for WebCrypto verify. */
const importVerifyKey = (publicKeyXY: Uint8Array): Promise<CryptoKey> => {
    const uncompressed = new Uint8Array(65)
    uncompressed[0] = 0x04
    uncompressed.set(publicKeyXY, 1)
    return crypto.subtle.importKey(
        'raw',
        uncompressed as BufferSource,
        { name: 'ECDSA', namedCurve: 'P-256' },
        false,
        ['verify'],
    )
}

describe('keystore-chrome webauthn signer', () => {
    let fake: ChromeFake
    let store: Store<KeyStoreState>

    beforeEach(async () => {
        fake = createChromeFake()
        globalThis.chrome = fake.chrome
        storage.resetForTesting()
        await hydrateKeystoreStorage()
        for (const key of storage.getAllKeys()) storage.remove(key)
        store = new Store<KeyStoreState>({ keys: [], status: 'idle' })
        await createVault('pw')
    })

    describe('createP256Credential', () => {
        it('persists an hd-derived-p256 key with the expected metadata and a signable XY public key', async () => {
            await importSeed({ store, seed: new Uint8Array(64).fill(7) })
            const signer = createKeystoreSigner(store)
            const userHandleOriginalB64Url = bytesToB64url(
                new TextEncoder().encode('Alice'),
            )

            const { keyId, publicKeyXY } = await signer.createP256Credential({
                rpId: 'webauthn.io',
                userHandle: 'alice',
                userHandleOriginalB64Url,
                displayName: 'Alice',
                userName: 'alice@example.com',
            })

            const key = store.state.keys.find(k => k.id === keyId)
            expect(key).toBeDefined()
            expect(key?.type).toBe('hd-derived-p256')
            expect(key?.algorithm).toBe('P256')
            expect(key?.metadata?.origin).toBe('webauthn.io')
            expect(key?.metadata?.userHandle).toBe('alice')
            // The byte-exact original is stored separately from the
            // (lowercased) derivation `userHandle` above.
            expect(key?.metadata?.userHandleOriginal).toBe(
                userHandleOriginalB64Url,
            )
            expect(key?.metadata?.displayName).toBe('Alice')
            expect(key?.metadata?.userName).toBe('alice@example.com')

            expect(publicKeyXY).toBeInstanceOf(Uint8Array)
            expect(publicKeyXY).toHaveLength(64)
        })

        it('lowercases userHandle before persisting it to metadata, without touching userHandleOriginalB64Url', async () => {
            await importSeed({ store, seed: new Uint8Array(64).fill(7) })
            const signer = createKeystoreSigner(store)
            const userHandleOriginalB64Url = bytesToB64url(
                new TextEncoder().encode('AliceMixedCase'),
            )

            // The Task 2 core already lowercases before calling this method;
            // simulate a caller that (incorrectly) didn't, to prove the
            // defensive `.toLowerCase()` in this adapter still normalizes the
            // *derivation* field — the original-bytes field must NOT be
            // touched by that normalization.
            const { keyId } = await signer.createP256Credential({
                rpId: 'webauthn.io',
                userHandle: 'AliceMixedCase',
                userHandleOriginalB64Url,
                displayName: 'Alice',
            })

            const key = store.state.keys.find(k => k.id === keyId)
            expect(key?.metadata?.userHandle).toBe('alicemixedcase')
            expect(key?.metadata?.userHandleOriginal).toBe(
                userHandleOriginalB64Url,
            )
        })

        it('reuses a single persisted hd-root-key across multiple credentials', async () => {
            await importSeed({ store, seed: new Uint8Array(64).fill(7) })
            const signer = createKeystoreSigner(store)

            await signer.createP256Credential({
                rpId: 'webauthn.io',
                userHandle: 'alice',
                userHandleOriginalB64Url: bytesToB64url(
                    new TextEncoder().encode('alice'),
                ),
                displayName: 'Alice',
            })
            await signer.createP256Credential({
                rpId: 'example.com',
                userHandle: 'bob',
                userHandleOriginalB64Url: bytesToB64url(
                    new TextEncoder().encode('bob'),
                ),
                displayName: 'Bob',
            })

            const rootKeys = store.state.keys.filter(
                k => k.type === 'hd-root-key',
            )
            expect(rootKeys).toHaveLength(1)

            const passkeys = store.state.keys.filter(
                k => k.type === 'hd-derived-p256',
            )
            expect(passkeys).toHaveLength(2)
            expect(
                passkeys.every(
                    k => k.metadata?.parentKeyId === rootKeys[0]?.id,
                ),
            ).toBe(true)
        })

        it('throws when no wallet seed exists in the keystore', async () => {
            const signer = createKeystoreSigner(store)
            await expect(
                signer.createP256Credential({
                    rpId: 'webauthn.io',
                    userHandle: 'alice',
                    userHandleOriginalB64Url: bytesToB64url(
                        new TextEncoder().encode('alice'),
                    ),
                    displayName: 'Alice',
                }),
            ).rejects.toThrow()
        })
    })

    describe('signP256', () => {
        it('returns a raw 64-byte signature verifiable against the credential public key', async () => {
            await importSeed({ store, seed: new Uint8Array(64).fill(7) })
            const signer = createKeystoreSigner(store)

            const { keyId, publicKeyXY } = await signer.createP256Credential({
                rpId: 'webauthn.io',
                userHandle: 'alice',
                userHandleOriginalB64Url: bytesToB64url(
                    new TextEncoder().encode('alice'),
                ),
                displayName: 'Alice',
            })

            const data = new TextEncoder().encode(
                'authenticatorData || clientDataHash',
            )
            const signature = await signer.signP256(keyId, data)

            expect(signature).toBeInstanceOf(Uint8Array)
            expect(signature).toHaveLength(64)

            const verifyKey = await importVerifyKey(publicKeyXY)
            const isValid = await crypto.subtle.verify(
                { name: 'ECDSA', hash: 'SHA-256' },
                verifyKey,
                signature as BufferSource,
                data as BufferSource,
            )
            expect(isValid).toBe(true)
        })

        it("fails verification against a different credential's public key (round-trip proves the derivation is domain-specific)", async () => {
            await importSeed({ store, seed: new Uint8Array(64).fill(7) })
            const signer = createKeystoreSigner(store)

            const credentialA = await signer.createP256Credential({
                rpId: 'webauthn.io',
                userHandle: 'alice',
                userHandleOriginalB64Url: bytesToB64url(
                    new TextEncoder().encode('alice'),
                ),
                displayName: 'Alice',
            })
            const credentialB = await signer.createP256Credential({
                rpId: 'example.com',
                userHandle: 'bob',
                userHandleOriginalB64Url: bytesToB64url(
                    new TextEncoder().encode('bob'),
                ),
                displayName: 'Bob',
            })

            const data = new TextEncoder().encode('some payload')
            const signature = await signer.signP256(credentialA.keyId, data)

            const wrongVerifyKey = await importVerifyKey(
                credentialB.publicKeyXY,
            )
            const isValid = await crypto.subtle.verify(
                { name: 'ECDSA', hash: 'SHA-256' },
                wrongVerifyKey,
                signature as BufferSource,
                data as BufferSource,
            )
            expect(isValid).toBe(false)
        })
    })

    describe('listP256Credentials', () => {
        it('returns only the passkeys registered for the given rpId', async () => {
            await importSeed({ store, seed: new Uint8Array(64).fill(7) })
            const signer = createKeystoreSigner(store)

            const registered = await signer.createP256Credential({
                rpId: 'webauthn.io',
                userHandle: 'alice',
                userHandleOriginalB64Url: bytesToB64url(
                    new TextEncoder().encode('alice'),
                ),
                displayName: 'Alice',
            })
            await signer.createP256Credential({
                rpId: 'example.com',
                userHandle: 'bob',
                userHandleOriginalB64Url: bytesToB64url(
                    new TextEncoder().encode('bob'),
                ),
                displayName: 'Bob',
            })

            const credentials = await signer.listP256Credentials('webauthn.io')

            expect(credentials).toHaveLength(1)
            expect(credentials[0]?.keyId).toBe(registered.keyId)
            expect(credentials[0]?.publicKeyXY).toEqual(registered.publicKeyXY)
            expect(credentials[0]?.credentialId).toEqual(
                deriveCredentialId(registered.publicKeyXY),
            )
        })

        it('returns the byte-exact original user.id (not the lossy lowercased derivation string) as userHandle', async () => {
            await importSeed({ store, seed: new Uint8Array(64).fill(7) })
            const signer = createKeystoreSigner(store)
            // Mixed case: differs from the lowercased derivation `userHandle`
            // this adapter persists, proving `listP256Credentials` reads the
            // original-bytes field, not the derivation one.
            const userHandleOriginalB64Url = bytesToB64url(
                new TextEncoder().encode('Alice'),
            )

            await signer.createP256Credential({
                rpId: 'webauthn.io',
                userHandle: 'alice',
                userHandleOriginalB64Url,
                displayName: 'Alice',
            })

            const [credential] = await signer.listP256Credentials('webauthn.io')
            expect(credential?.userHandle).toBe(userHandleOriginalB64Url)
            expect(
                new TextDecoder().decode(
                    b64urlToBytes(credential?.userHandle ?? ''),
                ),
            ).toBe('Alice')
        })

        it('round-trips an opaque, non-UTF-8, mixed-case-b64url user.id byte-for-byte through create -> list', async () => {
            await importSeed({ store, seed: new Uint8Array(64).fill(7) })
            const signer = createKeystoreSigner(store)

            // A webauthn.io-style opaque random handle: not valid UTF-8, not
            // case-normalizable. Only the byte-exact original-bytes field can
            // reconstruct this — the lossy derivation string never could.
            const opaqueUserId = Uint8Array.from([
                0xff, 0x00, 0xab, 0x10, 0x9a, 0x5c, 0x00, 0x01, 0x7e, 0x3d,
            ])
            const userHandleOriginalB64Url = bytesToB64url(opaqueUserId)

            await signer.createP256Credential({
                rpId: 'webauthn.io',
                userHandle: 'opaque-fallback-derivation-handle',
                userHandleOriginalB64Url,
                displayName: 'Opaque User',
            })

            const [credential] = await signer.listP256Credentials('webauthn.io')
            expect(credential?.userHandle).toBe(userHandleOriginalB64Url)
            expect(
                Array.from(b64urlToBytes(credential?.userHandle ?? '')),
            ).toEqual(Array.from(opaqueUserId))
        })

        it('falls back to base64url of the derivation userHandle for a pre-existing key with no userHandleOriginal metadata', async () => {
            // Simulates a credential minted before this adapter started
            // persisting `userHandleOriginal` — must remain listable rather
            // than being dropped, even though this fallback isn't
            // byte-identical to the RP's real original `user.id`.
            store.setState(state => ({
                ...state,
                keys: [
                    ...state.keys,
                    {
                        id: 'legacy-key',
                        type: 'hd-derived-p256',
                        algorithm: 'P256',
                        extractable: true,
                        publicKey: new Uint8Array(64).fill(5),
                        metadata: {
                            origin: 'webauthn.io',
                            userHandle: 'alice',
                        },
                    },
                ],
            }))
            const signer = createKeystoreSigner(store)

            const [credential] = await signer.listP256Credentials('webauthn.io')
            expect(credential?.userHandle).toBe(
                bytesToB64url(new TextEncoder().encode('alice')),
            )
        })

        it('never returns a vault-unlock-shaped keystore entry, even if it names this rpId', async () => {
            await importSeed({ store, seed: new Uint8Array(64).fill(7) })
            const signer = createKeystoreSigner(store)

            await signer.createP256Credential({
                rpId: 'webauthn.io',
                userHandle: 'alice',
                userHandleOriginalB64Url: bytesToB64url(
                    new TextEncoder().encode('alice'),
                ),
                displayName: 'Alice',
            })

            // The M2 vault-unlock passkey is a browser-platform WebAuthn
            // credential (see enablePasskeyUnlock/vault/passkey.ts) — it
            // never becomes a keystore Key at all, since its only footprint
            // is the PRF-wrapped master key blob in chrome.storage.local.
            // This synthesizes what a mistakenly-inserted keystore entry for
            // it would look like (non-`hd-derived-p256` type) to prove
            // `isPasskeyKey`'s type filter — not just the origin match —
            // is what keeps it out of the WebAuthn passkey list.
            store.setState(state => ({
                ...state,
                keys: [
                    ...state.keys,
                    {
                        id: 'vault-unlock-key',
                        type: 'ecc',
                        algorithm: 'P256',
                        extractable: false,
                        publicKey: new Uint8Array(64).fill(9),
                        metadata: {
                            origin: 'webauthn.io',
                            userHandle: 'pera-vault',
                        },
                    },
                ],
            }))

            const credentials = await signer.listP256Credentials('webauthn.io')
            expect(credentials.some(c => c.keyId === 'vault-unlock-key')).toBe(
                false,
            )
            expect(credentials).toHaveLength(1)
        })
    })
})

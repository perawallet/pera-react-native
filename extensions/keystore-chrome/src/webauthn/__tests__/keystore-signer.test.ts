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
import type { Key, KeyStoreState } from '../../keystore'
import { DeterministicP256 } from '@algorandfoundation/dp256'
import { sha256 } from '@noble/hashes/sha2'
import { beforeEach, describe, expect, it } from 'vitest'
// This suite's resolution of the '/webauthn' subpath depends on
// packages/passkeys/dist existing (workspace subpath exports resolve against
// the built dist, not src). In a clean worktree without a prior `pnpm build`,
// this file fails to resolve the import and the keystore-chrome suite reads
// as 159 passing + 1 failing — that's a build-order artifact, not a bug. Run
// `pnpm build` (or at least build packages/passkeys) before trusting a red
// result here.
import {
    b64urlToBytes,
    bytesToB64url,
    deriveCredentialId,
    splitP256PublicKey,
} from '@perawallet/wallet-core-passkeys/webauthn'
import { createKeystoreSigner, type PasskeyKeyStore } from '../keystore-signer'

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

const WALLET_ROOT_ID = 'wallet-root'
const ENTROPY_CHILD_ID = 'wallet-root-entropy'
const ROOT_BYTES = new Uint8Array(96).fill(7)
const ENTROPY_BYTES = new Uint8Array(32).fill(9)
const PBKDF2_SALT = new TextEncoder().encode('pera-test-salt')

const metadataOf = (key: Key | undefined): Record<string, unknown> =>
    (key?.metadata ?? {}) as Record<string, unknown>

/**
 * A stand-in for the keystore-web engine, faithful on the two axes this
 * adapter depends on: a `pbkdf2-p256` main key is the only valid parent for
 * `deriveDomainKey`, and `sign` **re-derives** the child from that main key
 * plus the child's own `origin`/`userHandle`/`counter` metadata rather than
 * storing the child's private key. Re-deriving is what makes the signature
 * tests below meaningful — a normalization bug between registration and
 * signing shows up as a verification failure, exactly as it would in
 * production.
 *
 * Real `@algorandfoundation/dp256` throughout, so the derived keypairs and
 * signatures are the genuine article; only persistence is faked.
 */
type FakeEngine = PasskeyKeyStore & {
    generateCalls: { params?: Record<string, unknown> }[]
    /** Registers bytes for a key a test plants directly in the store. */
    addMaterial: (id: string, bytes: Uint8Array) => void
}

const createFakeEngine = (store: Store<KeyStoreState>): FakeEngine => {
    const dp = new DeterministicP256()
    const material = new Map<string, Uint8Array>()
    let counter = 0

    const put = (key: Key): void =>
        store.setState(state => ({
            ...state,
            keys: [...state.keys.filter(k => k.id !== key.id), key],
        }))

    const engine: FakeEngine = {
        generateCalls: [],

        addMaterial(id, bytes) {
            material.set(id, bytes)
        },

        async generate(options) {
            engine.generateCalls.push(options)
            const parentKeyId = options.params?.parentKeyId as string
            const parentBytes = material.get(parentKeyId)
            if (!parentBytes) {
                throw new Error(`fake engine: no material for ${parentKeyId}`)
            }
            const id = `main-key-${(counter += 1)}`
            material.set(
                id,
                await dp.genDerivedMainKey(parentBytes, PBKDF2_SALT, 10, 32),
            )
            put({
                id,
                type: 'hd-root-key',
                algorithm: 'P256',
                extractable: false,
                metadata: {
                    storage: 'bytes',
                    scheme: 'pbkdf2-p256',
                    parentKeyId,
                },
            } as Key)
            return id
        },

        async deriveDomainKey(mainKeyId, options) {
            const main = material.get(mainKeyId)
            if (!main) throw new Error(`fake engine: no main key ${mainKeyId}`)
            const origin = options.origin as string
            const userHandle = options.userHandle as string
            const domainCounter = options.counter ?? 0
            const privateKey = await dp.genDomainSpecificKeyPair(
                main,
                origin,
                userHandle,
                domainCounter,
            )
            const id = options.id ?? `credential-${(counter += 1)}`
            put({
                id,
                type: 'hd-derived-p256',
                algorithm: 'P256',
                extractable: false,
                publicKey: dp.getPurePKBytes(privateKey),
                metadata: {
                    storage: 'none',
                    scheme: 'pbkdf2-p256',
                    parentKeyId: mainKeyId,
                    origin,
                    userHandle,
                    counter: domainCounter,
                    ...options.metadata,
                },
            } as Key)
            return id
        },

        async sign(id, data) {
            const key = store.state.keys.find(k => k.id === id)
            const meta = metadataOf(key)
            const main = material.get(meta.parentKeyId as string)
            if (!main) throw new Error(`fake engine: no main key for ${id}`)
            const privateKey = await dp.genDomainSpecificKeyPair(
                main,
                meta.origin as string,
                meta.userHandle as string,
                (meta.counter as number) ?? 0,
            )
            // The engine's Deterministic-P256 shim SHA-256s before handing the
            // payload to dp256's raw signer. Modelling that here is the whole
            // point: an earlier fake signed `data` directly, so an adapter that
            // pre-hashed looked correct in unit tests and produced
            // `SHA256(SHA256(…))` — unverifiable by any relying party — in the
            // browser.
            return dp.signWithDomainSpecificKeyPair(privateKey, sha256(data))
        },
    }

    // The wallet's own root, as `useHDWallet` writes it on this branch: the
    // 96-byte XHD extended root, NOT the BIP39 entropy.
    material.set(WALLET_ROOT_ID, ROOT_BYTES)
    put({
        id: WALLET_ROOT_ID,
        type: 'hd-root-key',
        algorithm: 'raw',
        extractable: false,
        metadata: { storage: 'bytes', scheme: 'bip39' },
    } as Key)

    // Decoys, deliberately ahead of the real entropy child so a predicate that
    // drops any one clause picks one of these instead. Each defeats exactly one
    // clause: wrong type, missing flag, wrong parent. PBKDF2ing any of them
    // would mint a main key no mnemonic reproduces.
    material.set('decoy-wrong-type', new Uint8Array(32).fill(1))
    put({
        id: 'decoy-wrong-type',
        type: 'hd-derived-ed25519',
        algorithm: 'raw',
        extractable: false,
        metadata: { parentKeyId: WALLET_ROOT_ID, entropyKey: true },
    } as Key)
    material.set('decoy-unflagged', new Uint8Array(32).fill(2))
    put({
        id: 'decoy-unflagged',
        type: 'secret-key',
        algorithm: 'raw',
        extractable: false,
        metadata: { parentKeyId: WALLET_ROOT_ID },
    } as Key)
    material.set('decoy-other-wallet', new Uint8Array(32).fill(3))
    put({
        id: 'decoy-other-wallet',
        type: 'secret-key',
        algorithm: 'raw',
        extractable: false,
        metadata: { parentKeyId: 'some-other-root', entropyKey: true },
    } as Key)

    // The 32-byte BIP39 entropy, stored apart from the root by `useHDWallet`.
    material.set(ENTROPY_CHILD_ID, ENTROPY_BYTES)
    put({
        id: ENTROPY_CHILD_ID,
        type: 'secret-key',
        algorithm: 'raw',
        extractable: false,
        metadata: {
            storage: 'bytes',
            parentKeyId: WALLET_ROOT_ID,
            entropyKey: true,
        },
    } as Key)

    return engine
}

/** Adds a second wallet root (with its entropy child, unless opted out). */
const plantRoot = (
    store: Store<KeyStoreState>,
    engine: FakeEngine,
    rootId: string,
    {
        withEntropyChild = true,
        first = false,
    }: { withEntropyChild?: boolean; first?: boolean } = {},
): void => {
    const planted: Key[] = [
        {
            id: rootId,
            type: 'hd-root-key',
            algorithm: 'raw',
            extractable: false,
            metadata: { storage: 'bytes', scheme: 'bip39' },
        } as Key,
    ]
    if (withEntropyChild) {
        const entropyId = `${rootId}-entropy`
        engine.addMaterial(entropyId, new Uint8Array(32).fill(4))
        planted.push({
            id: entropyId,
            type: 'secret-key',
            algorithm: 'raw',
            extractable: false,
            metadata: {
                storage: 'bytes',
                parentKeyId: rootId,
                entropyKey: true,
            },
        } as Key)
    }
    store.setState(state => ({
        ...state,
        keys: first ? [...planted, ...state.keys] : [...state.keys, ...planted],
    }))
}

const credentialParams = (overrides: Record<string, unknown> = {}) => ({
    rpId: 'webauthn.io',
    userHandle: 'alice',
    userHandleOriginalB64Url: bytesToB64url(new TextEncoder().encode('alice')),
    displayName: 'Alice',
    userName: 'alice@example.com',
    ...overrides,
})

describe('keystore-chrome webauthn signer', () => {
    let store: Store<KeyStoreState>
    let engine: FakeEngine

    beforeEach(() => {
        store = new Store<KeyStoreState>({ keys: [], status: 'idle' })
        engine = createFakeEngine(store)
    })

    describe('createP256Credential', () => {
        it("mints a pbkdf2-p256 main key from the wallet root's entropy child, then derives the credential from it", async () => {
            const signer = createKeystoreSigner(engine, store)

            const { keyId, publicKeyXY } =
                await signer.createP256Credential(credentialParams())

            // The engine only accepts a `pbkdf2-p256` main key as the parent
            // of a domain key, and that main key must descend from the
            // wallet's BIP39 entropy so the credential is seed-recoverable.
            const mainKey = store.state.keys.find(
                k => metadataOf(k).scheme === 'pbkdf2-p256' && k.id !== keyId,
            )
            expect(mainKey?.type).toBe('hd-root-key')
            expect(metadataOf(mainKey).parentKeyId).toBe(ENTROPY_CHILD_ID)

            const credential = store.state.keys.find(k => k.id === keyId)
            expect(credential?.type).toBe('hd-derived-p256')
            expect(metadataOf(credential).parentKeyId).toBe(mainKey?.id)
            expect(metadataOf(credential).origin).toBe('webauthn.io')
            expect(metadataOf(credential).userHandle).toBe('alice')
            expect(metadataOf(credential).userHandleOriginal).toBe(
                credentialParams().userHandleOriginalB64Url,
            )
            expect(metadataOf(credential).displayName).toBe('Alice')
            expect(metadataOf(credential).userName).toBe('alice@example.com')
            expect(publicKeyXY).toHaveLength(64)
        })

        it('reuses the existing main key across credentials instead of minting one per passkey', async () => {
            const signer = createKeystoreSigner(engine, store)

            await signer.createP256Credential(credentialParams())
            await signer.createP256Credential(
                credentialParams({ rpId: 'example.com', userHandle: 'bob' }),
            )

            expect(engine.generateCalls).toHaveLength(1)
        })

        // A wallet imported before the canary.14 relabel still carries `seed`.
        it('accepts a legacy seed entry as the wallet root', async () => {
            store.setState(state => ({
                ...state,
                keys: state.keys.map(k =>
                    k.id === WALLET_ROOT_ID
                        ? ({ ...k, type: 'seed' } as Key)
                        : k,
                ),
            }))
            const signer = createKeystoreSigner(engine, store)

            const { keyId } =
                await signer.createP256Credential(credentialParams())

            expect(keyId).toBeTruthy()
            expect(engine.generateCalls[0]?.params?.parentKeyId).toBe(
                ENTROPY_CHILD_ID,
            )
        })

        // The whole point of the entropy-child parent: `generateDP256Main`
        // PBKDF2s the parent's stored bytes verbatim, so parenting on the
        // 96-byte extended root would give a main key no mnemonic reproduces
        // on any other platform.
        it('PBKDF2s the BIP39 entropy, not the 96-byte extended root', async () => {
            const signer = createKeystoreSigner(engine, store)

            const { publicKeyXY } =
                await signer.createP256Credential(credentialParams())

            const dp = new DeterministicP256()
            const fromEntropy = await dp.genDerivedMainKey(
                ENTROPY_BYTES,
                PBKDF2_SALT,
                10,
                32,
            )
            const fromRoot = await dp.genDerivedMainKey(
                ROOT_BYTES,
                PBKDF2_SALT,
                10,
                32,
            )
            const flatXYFor = async (
                mainKey: Uint8Array,
            ): Promise<number[]> => {
                const pk = dp.getPurePKBytes(
                    await dp.genDomainSpecificKeyPair(
                        mainKey,
                        'webauthn.io',
                        'alice',
                        0,
                    ),
                )
                const { x, y } = splitP256PublicKey(pk)
                return [...x, ...y]
            }
            const expected = await flatXYFor(fromEntropy)
            const wrong = await flatXYFor(fromRoot)

            // Non-vacuity: the two parents really do yield different keys, so
            // the assertion below can only pass for the entropy one.
            expect(wrong).not.toEqual(expected)
            expect([...publicKeyXY]).toEqual(expected)
        })

        // Same formula as `usePasskeyMainKey`/`repairs/0003` on mobile, so a
        // keystore written by either side is recognised by the other.
        it('names the main key with the shared `<seedKeyId>-passkey-main` id', async () => {
            const signer = createKeystoreSigner(engine, store)

            await signer.createP256Credential(credentialParams())

            expect(engine.generateCalls[0]?.params?.id).toBe(
                `${WALLET_ROOT_ID}-passkey-main`,
            )
        })

        // `repairs/0003` and `useKMS` both sort their root pick, and the device
        // gets exactly one main key. If this side picked by store order, a
        // two-wallet device would mint a different main key here than mobile
        // does from the same seeds, and the passkeys would not match.
        it('picks the lowest-sorted wallet root, whatever the store order', async () => {
            // Appended after `wallet-root`, so store order and sort order
            // disagree: an unsorted scan takes `wallet-root`.
            plantRoot(store, engine, 'zzz-root')
            plantRoot(store, engine, 'aaa-root')
            const signer = createKeystoreSigner(engine, store)

            await signer.createP256Credential(credentialParams())

            expect(engine.generateCalls[0]?.params).toMatchObject({
                parentKeyId: 'aaa-root-entropy',
                id: 'aaa-root-passkey-main',
            })
        })

        // An Algo25 or watch-only root has no BIP39 entropy to PBKDF2, so it
        // cannot own the main key even when it sorts first — `repairs/0003`
        // skips to the next root rather than leaving the device without one.
        it('skips a lower-sorted wallet root that has no entropy child', async () => {
            // Planted ahead of `wallet-root`, so an unsorted scan reaches it
            // first and this test cannot pass by accident.
            plantRoot(store, engine, 'aaa-root', {
                withEntropyChild: false,
                first: true,
            })
            const signer = createKeystoreSigner(engine, store)

            await signer.createP256Credential(credentialParams())

            expect(engine.generateCalls[0]?.params).toMatchObject({
                parentKeyId: ENTROPY_CHILD_ID,
                id: `${WALLET_ROOT_ID}-passkey-main`,
            })
        })

        it('throws when the wallet root has no entropy child to derive from', async () => {
            store.setState(state => ({
                ...state,
                keys: state.keys.filter(k => k.id !== ENTROPY_CHILD_ID),
            }))
            const signer = createKeystoreSigner(engine, store)

            await expect(
                signer.createP256Credential(credentialParams()),
            ).rejects.toThrow(/entropy/i)
        })

        it('lowercases userHandle for derivation without touching userHandleOriginalB64Url', async () => {
            const signer = createKeystoreSigner(engine, store)
            const userHandleOriginalB64Url = bytesToB64url(
                new TextEncoder().encode('AliceMixedCase'),
            )

            const { keyId } = await signer.createP256Credential(
                credentialParams({
                    userHandle: 'AliceMixedCase',
                    userHandleOriginalB64Url,
                }),
            )

            const credential = store.state.keys.find(k => k.id === keyId)
            expect(metadataOf(credential).userHandle).toBe('alicemixedcase')
            expect(metadataOf(credential).userHandleOriginal).toBe(
                userHandleOriginalB64Url,
            )
        })

        it('throws when the keystore holds no wallet root to derive from', async () => {
            store.setState(state => ({ ...state, keys: [] }))
            const signer = createKeystoreSigner(engine, store)

            await expect(
                signer.createP256Credential(credentialParams()),
            ).rejects.toThrow(/wallet/i)
        })
    })

    describe('signP256', () => {
        it('returns a raw 64-byte ES256 signature the credential public key verifies', async () => {
            const signer = createKeystoreSigner(engine, store)
            const { keyId, publicKeyXY } =
                await signer.createP256Credential(credentialParams())
            const payload = new TextEncoder().encode('authData||clientDataHash')

            const signature = await signer.signP256(keyId, payload)

            expect(signature).toHaveLength(64)
            // The RP verifies with `{name:'ECDSA', hash:'SHA-256'}` over the
            // raw payload, so WebCrypto hashes it once. This only passes if
            // exactly one SHA-256 happened on the signing side too.
            const verified = await crypto.subtle.verify(
                { name: 'ECDSA', hash: 'SHA-256' },
                await importVerifyKey(publicKeyXY),
                signature as BufferSource,
                payload as BufferSource,
            )
            expect(verified).toBe(true)
        })

        // Regression pin. The engine hashes internally; pre-hashing here would
        // sign SHA256(SHA256(payload)), which no relying party can verify.
        it('hands the payload to the engine unhashed, leaving ES256 hashing to it', async () => {
            const signer = createKeystoreSigner(engine, store)
            const { keyId } =
                await signer.createP256Credential(credentialParams())
            const payload = new TextEncoder().encode('authData||clientDataHash')

            const signature = await signer.signP256(keyId, payload)

            // dp256 is deterministic (RFC 6979), so identical inputs give
            // identical bytes — which makes this an exact assertion about
            // *what* was signed, not just that signing succeeded.
            expect(signature).toEqual(await engine.sign(keyId, payload))
            expect(signature).not.toEqual(
                await engine.sign(keyId, sha256(payload)),
            )
        })

        it("fails verification against a different credential's public key, proving the derivation is domain-specific", async () => {
            const signer = createKeystoreSigner(engine, store)
            const alice = await signer.createP256Credential(credentialParams())
            const bob = await signer.createP256Credential(
                credentialParams({ userHandle: 'bob' }),
            )
            const payload = new TextEncoder().encode('authData||clientDataHash')

            const signature = await signer.signP256(alice.keyId, payload)

            expect(
                await crypto.subtle.verify(
                    { name: 'ECDSA', hash: 'SHA-256' },
                    await importVerifyKey(bob.publicKeyXY),
                    signature as BufferSource,
                    payload as BufferSource,
                ),
            ).toBe(false)
        })
    })

    describe('listP256Credentials', () => {
        it('returns only the passkeys registered for the given rpId', async () => {
            const signer = createKeystoreSigner(engine, store)
            const registered =
                await signer.createP256Credential(credentialParams())
            await signer.createP256Credential(
                credentialParams({
                    rpId: 'example.com',
                    userHandle: 'bob',
                    userHandleOriginalB64Url: bytesToB64url(
                        new TextEncoder().encode('bob'),
                    ),
                    displayName: 'Bob',
                }),
            )

            const credentials = await signer.listP256Credentials('webauthn.io')

            expect(credentials).toHaveLength(1)
            expect(credentials[0]?.keyId).toBe(registered.keyId)
            expect(credentials[0]?.publicKeyXY).toEqual(registered.publicKeyXY)
            expect(credentials[0]?.credentialId).toEqual(
                deriveCredentialId(registered.publicKeyXY),
            )
        })

        it('returns the byte-exact original user.id, not the lossy lowercased derivation string', async () => {
            const signer = createKeystoreSigner(engine, store)
            const userHandleOriginalB64Url = bytesToB64url(
                new TextEncoder().encode('Alice'),
            )

            await signer.createP256Credential(
                credentialParams({ userHandleOriginalB64Url }),
            )

            const [credential] = await signer.listP256Credentials('webauthn.io')
            expect(credential?.userHandle).toBe(userHandleOriginalB64Url)
            expect(
                new TextDecoder().decode(
                    b64urlToBytes(credential?.userHandle ?? ''),
                ),
            ).toBe('Alice')
        })

        it('round-trips an opaque, non-UTF-8 user.id byte-for-byte through create -> list', async () => {
            const signer = createKeystoreSigner(engine, store)
            const opaque = Uint8Array.from([0xff, 0x00, 0x41, 0xfe, 0x7f, 0x80])
            const userHandleOriginalB64Url = bytesToB64url(opaque)

            await signer.createP256Credential(
                credentialParams({ userHandleOriginalB64Url }),
            )

            const [credential] = await signer.listP256Credentials('webauthn.io')
            expect(b64urlToBytes(credential?.userHandle ?? '')).toEqual(opaque)
        })

        it('falls back to base64url of the derivation userHandle when userHandleOriginal is absent', async () => {
            const signer = createKeystoreSigner(engine, store)
            store.setState(state => ({
                ...state,
                keys: [
                    ...state.keys,
                    {
                        id: 'legacy-credential',
                        type: 'hd-derived-p256',
                        algorithm: 'P256',
                        extractable: false,
                        publicKey: new Uint8Array(64).fill(3),
                        metadata: {
                            origin: 'webauthn.io',
                            userHandle: 'alice',
                        },
                    } as Key,
                ],
            }))

            const [credential] = await signer.listP256Credentials('webauthn.io')
            expect(credential?.userHandle).toBe(
                bytesToB64url(new TextEncoder().encode('alice')),
            )
        })

        it('never returns a vault-unlock-shaped keystore entry, even if it names this rpId', async () => {
            const signer = createKeystoreSigner(engine, store)
            await signer.createP256Credential(credentialParams())

            // The M2 vault-unlock passkey is a browser-platform WebAuthn
            // credential (see enablePasskeyUnlock/vault/passkey.ts) — it never
            // becomes a keystore Key at all. This synthesizes what a
            // mistakenly-inserted entry would look like to prove
            // `isPasskeyKey`'s type filter, not just the origin match, keeps
            // it out of the WebAuthn passkey list.
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
                    } as Key,
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

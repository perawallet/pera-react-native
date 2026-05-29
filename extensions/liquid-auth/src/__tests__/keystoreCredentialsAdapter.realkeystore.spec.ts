/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

// Real-keystore integration test for the in-app P256 credential adapter.
//
// The in-memory keystore test util shipped with apps/mobile only implements
// ed25519 derivation, so it can't exercise the P256 path that broke with
// "Seed is required to generate P256 key". This test instead wires the adapter
// to a tiny keystore harness that delegates to the REAL keystore-core
// primitives (`generateXHDRootKeyFromSeed`, `generateXHDFromParent`,
// `signWithKeyData`) and the real `dp256`. It therefore drives the genuine
// derive -> sign -> verify math the device runs, and would have caught the
// dangling-parent / wrong-key-type regressions.

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { p256 } from '@noble/curves/p256'
import {
    generateXHDRootKeyFromSeed,
    generateXHDFromParent,
    signWithKeyData,
    type Key,
    type KeyData,
} from '@algorandfoundation/keystore'

// ---------------------------------------------------------------------------
// Real-keystore harness
//
// Mirrors how `@algorandfoundation/react-native-keystore`'s store wires the
// keystore-core functions: `generate` for an `hd-root-key` builds + commits the
// XHD root from a seed; `generate` for an `hd-derived-p256` derives the domain
// key from a (committed) root and stamps `metadata.parentKeyId`; `sign`
// re-resolves that parent and re-derives via the core signer. Bytes never leave
// this module except the public key, which is mirrored onto the reactive store
// snapshot exactly like production.

type StoreState = { keys: Key[]; status: string }
type Listener = () => void

const secrets = new Map<string, KeyData>()
let snapshot: Key[] = []
const listeners = new Set<Listener>()

const reactiveStore = {
    get state(): StoreState {
        return { keys: snapshot, status: 'idle' }
    },
    setState(updater: (s: StoreState) => StoreState): void {
        const next = updater({ keys: snapshot, status: 'idle' })
        snapshot = next.keys
        listeners.forEach(l => l())
    },
    subscribe(listener: Listener): { unsubscribe: () => void } {
        listeners.add(listener)
        return { unsubscribe: () => listeners.delete(listener) }
    },
}

const stripPrivate = (key: KeyData): Key => {
    const { privateKey: _pk, ...rest } = key as KeyData & {
        privateKey?: Uint8Array
    }
    return rest as Key
}

// Deep clone so the keystore-core functions (which zero/clear privateKey
// buffers via `clearKeyData` after use) cannot corrupt the stored material.
// Production MMKV serialises on commit and returns fresh copies on read, so
// this mirrors its copy-on-write semantics.
const clone = (key: KeyData): KeyData => {
    const copy = { ...key } as KeyData & {
        privateKey?: Uint8Array
        publicKey?: Uint8Array
    }
    const src = key as KeyData & {
        privateKey?: Uint8Array
        publicKey?: Uint8Array
    }
    if (src.privateKey instanceof Uint8Array) {
        copy.privateKey = new Uint8Array(src.privateKey)
    }
    if (src.publicKey instanceof Uint8Array) {
        copy.publicKey = new Uint8Array(src.publicKey)
    }
    if (key.metadata) copy.metadata = { ...key.metadata }
    return copy
}

const fetchSecret = (id: string): KeyData | undefined => {
    const entry = secrets.get(id)
    return entry ? clone(entry) : undefined
}

const commit = (key: KeyData): void => {
    secrets.set(key.id, clone(key))
    snapshot = [...snapshot.filter(k => k.id !== key.id), stripPrivate(key)]
    listeners.forEach(l => l())
}

const keyStore = {
    state: reactiveStore.state,
    async import(data: Omit<KeyData, 'id'> & { id: string }): Promise<string> {
        commit(data as KeyData)
        return data.id
    },
    async generate(options: {
        type: string
        algorithm: string
        extractable: boolean
        keyUsages: string[]
        params?: Record<string, unknown>
    }): Promise<string> {
        const params = options.params ?? {}
        const parentKeyId = params.parentKeyId as string | undefined
        if (!parentKeyId) {
            throw new Error('harness: generate requires params.parentKeyId')
        }
        const parent = fetchSecret(parentKeyId)
        if (!parent) {
            throw new Error(`harness: parent key not found: ${parentKeyId}`)
        }

        if (options.type === 'hd-root-key') {
            // Build + commit the XHD root from the seed (mirrors the rn-keystore
            // store generating an `hd-root-key` from a `seed`/`hd-seed`).
            const root = await generateXHDRootKeyFromSeed(
                { ...parent, type: 'hd-seed', format: 'raw' } as never,
                { id: params.id as string | undefined },
            )
            commit(root as KeyData)
            return root.id
        }

        if (options.type === 'hd-derived-p256') {
            // Parent must be a committed hd-root-key — exactly what the adapter
            // now ensures before deriving.
            const derived = await generateXHDFromParent({
                key: {
                    id: params.id as string | undefined,
                    type: 'hd-derived-p256',
                    metadata: {
                        origin: params.origin,
                        userHandle: params.userHandle,
                        counter: params.counter ?? 0,
                    },
                } as never,
                parentKey: { ...parent, type: 'hd-root-key' } as never,
            })
            commit(derived as KeyData)
            return derived.id
        }

        throw new Error(`harness: unsupported generate type ${options.type}`)
    },
    async sign(id: string, data: Uint8Array): Promise<Uint8Array> {
        const key = fetchSecret(id)
        if (!key) throw new Error(`harness: key not found: ${id}`)
        const parentKeyId = key.metadata?.parentKeyId as string | undefined
        if (!parentKeyId) throw new Error('harness: key has no parentKeyId')
        const parent = fetchSecret(parentKeyId)
        if (!parent) {
            // This is the regression we are guarding against: a P256 key whose
            // parent was never committed would land here.
            throw new Error(
                `harness: parent key not found for sign: ${parentKeyId}`,
            )
        }
        return signWithKeyData({
            key,
            data,
            parentKey: {
                ...parent,
                type: 'hd-root-key',
                format: 'raw',
            } as never,
        })
    },
}

const getKeystoreStore = vi.fn(() => reactiveStore)
const getProvider = vi.fn(() => ({ key: { store: keyStore } }))

vi.mock('@perawallet/wallet-extension-provider', () => ({
    getKeystoreStore: () => getKeystoreStore(),
    getProvider: () => getProvider(),
}))

// Imported after the mock is registered.
const { createKeystoreP256KeyAccess } =
    await import('../keystoreCredentialsAdapter')

// ---------------------------------------------------------------------------

const ORIGIN = 'https://debug.liquidauth.com'
const USER_HANDLE = 'Alice@Example.com' // mixed case — must be lowercased
const SEED_ID = 'pera-seed-1'

const reset = (): void => {
    secrets.clear()
    snapshot = []
    listeners.clear()
}

const importSeed = async (): Promise<void> => {
    // A 96-byte XHD-root-shaped seed, matching how Pera persists wallet roots
    // (`type:'seed'`, privateKey holding the XHD root bytes).
    const privateKey = new Uint8Array(96)
    for (let i = 0; i < privateKey.length; i++)
        privateKey[i] = (i * 7 + 3) & 0xff
    await keyStore.import({
        id: SEED_ID,
        type: 'seed',
        algorithm: 'raw',
        format: 'bytes',
        extractable: true,
        keyUsages: ['deriveKey', 'deriveBits'],
        privateKey,
        metadata: {},
    } as never)
}

describe('createKeystoreP256KeyAccess against a real keystore', () => {
    beforeEach(async () => {
        reset()
        await importSeed()
    })

    it('derives a 64-byte P256 public key bound to (origin, userHandle)', async () => {
        const access = createKeystoreP256KeyAccess()

        const result = await access.deriveP256({
            origin: ORIGIN,
            userHandle: USER_HANDLE,
        })

        expect(result.publicKeyXY.x).toHaveLength(32)
        expect(result.publicKeyXY.y).toHaveLength(32)
        expect(result.credentialId).toEqual(expect.any(String))

        // The committed root must exist (so signing can resolve the parent).
        expect(snapshot.some(k => k.type === 'hd-root-key')).toBe(true)
        const derived = secrets.get(result.keyId)
        expect(derived?.metadata?.parentKeyId).toBeDefined()
        expect(secrets.has(derived?.metadata?.parentKeyId as string)).toBe(true)
    })

    it('produces a signature that verifies against the derived public key', async () => {
        const access = createKeystoreP256KeyAccess()

        const { keyId, publicKeyXY } = await access.deriveP256({
            origin: ORIGIN,
            userHandle: USER_HANDLE,
        })

        // 32-byte payload (e.g. the WebAuthn authenticator-data + clientData
        // hash the adapter signs as-is).
        const message = new Uint8Array(32).fill(9)
        const signature = await access.signP256(keyId, message)

        expect(signature).toHaveLength(64)

        // Reconstruct the uncompressed SEC1 public key (0x04 || x || y) and
        // verify the raw r‖s signature over the message (prehash:false).
        const uncompressed = new Uint8Array(65)
        uncompressed[0] = 0x04
        uncompressed.set(publicKeyXY.x, 1)
        uncompressed.set(publicKeyXY.y, 33)
        const valid = p256.verify(signature, message, uncompressed, {
            prehash: false,
        })
        expect(valid).toBe(true)
    })

    it('re-resolves the same key via getP256 by credentialId', async () => {
        const access = createKeystoreP256KeyAccess()

        const created = await access.deriveP256({
            origin: ORIGIN,
            userHandle: USER_HANDLE,
        })
        const resolved = await access.getP256(created.credentialId)

        expect(resolved).not.toBeNull()
        expect(resolved?.keyId).toBe(created.keyId)
        expect(resolved?.publicKeyXY.x).toEqual(created.publicKeyXY.x)
    })
})

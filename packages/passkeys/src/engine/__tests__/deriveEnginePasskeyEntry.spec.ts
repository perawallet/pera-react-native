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

// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { webcrypto } from 'node:crypto'
import {
    createDefaultShims,
    createKeyStore,
    type DriverMaterial,
    type Key,
    type KeyStoreDriver,
    type KeyStoreState,
} from '@algorandfoundation/keystore-core'

const subtle = webcrypto.subtle as unknown as SubtleCrypto

const engine = vi.hoisted(() => ({
    keystore: undefined as unknown,
    store: undefined as unknown,
}))

vi.mock('@perawallet/wallet-extension-provider', () => ({
    getKeystore: () => engine.keystore,
    getKeystoreStore: () => engine.store,
    keystoreSubtle: webcrypto.subtle,
    PASSKEY_MAIN_KEY_SCHEME: 'pbkdf2-p256',
}))

import {
    derivePasskeyCredential,
    derivePasskeyMainKey,
} from '../../crypto/derivePasskeyCredential'
import {
    deriveEnginePasskeyEntry,
    enginePasskeyEntryExists,
} from '../deriveEnginePasskeyEntry'

const SEED_ID = 'seed-1'
const ENTROPY_ID = 'seed-1-entropy'
const ENTROPY = new Uint8Array(32).fill(9)
const ORIGIN = 'webauthn.io'
const IDENTITY = 'yqtbrhu5qrcwgffbdgtlpw'

/** Persistence only; derivation, signing and the dp256 shim are the real engine's. */
const createMemoryDriver = (seed: {
    keys: Key[]
    material: Record<string, Uint8Array>
}): KeyStoreDriver => {
    const meta = new Map(seed.keys.map(key => [key.id, key]))
    const material = new Map<string, DriverMaterial>(
        Object.entries(seed.material).map(([id, bytes]) => [
            id,
            { kind: 'bytes', bytes: Uint8Array.from(bytes) },
        ]),
    )
    return {
        capabilities: {
            nativeCryptoKey: false,
            interactiveUnlock: false,
            authFactors: [],
        },
        async put(id, value) {
            material.set(id, value)
        },
        async use(id, _ctx, fn) {
            const value = material.get(id)
            if (!value) throw new Error(`no material for ${id}`)
            // The shims zero what they are handed, as the real drivers expect.
            return fn(
                value.kind === 'bytes'
                    ? { kind: 'bytes', bytes: Uint8Array.from(value.bytes) }
                    : value,
            )
        },
        async remove(id) {
            material.delete(id)
            meta.delete(id)
        },
        async putMeta(key) {
            meta.set(key.id, key)
        },
        async getMeta(id) {
            return meta.get(id)
        },
        async listMeta() {
            return [...meta.values()]
        },
    }
}

const seedKeys: Key[] = [
    {
        id: SEED_ID,
        type: 'hd-root-key',
        algorithm: 'raw',
        extractable: true,
        metadata: { scheme: 'bip39' },
    } as Key,
    {
        id: ENTROPY_ID,
        type: 'secret-key',
        algorithm: 'raw',
        extractable: false,
        metadata: { parentKeyId: SEED_ID, entropyKey: true },
    } as Key,
]

/** The two members the engine touches; `@tanstack/store` is not a dependency here. */
const createStore = () => {
    const store = {
        state: { keys: [], status: 'idle' } as KeyStoreState,
        setState(update: (state: KeyStoreState) => KeyStoreState) {
            store.state = update(store.state)
        },
    }
    return store
}

const startEngine = async () => {
    const store = createStore()
    const keystore = createKeyStore({
        driver: createMemoryDriver({
            keys: seedKeys,
            material: {
                [SEED_ID]: new Uint8Array(96).fill(7),
                [ENTROPY_ID]: ENTROPY,
            },
        }),
        store: store as unknown as Parameters<
            typeof createKeyStore
        >[0]['store'],
        subtle,
        shims: () => createDefaultShims(),
    })
    await keystore.ready
    engine.keystore = keystore
    engine.store = store
    return { keystore, store }
}

const expectedCredential = async (identity = IDENTITY, counter = 0) =>
    derivePasskeyCredential({
        mainKey: await derivePasskeyMainKey(ENTROPY, subtle),
        origin: ORIGIN,
        identity,
        counter,
    })

const baseParams = async () => {
    const expected = await expectedCredential()
    return {
        credentialId: 'restored-credential',
        origin: ORIGIN,
        identity: IDENTITY,
        counter: 0,
        seedKeyId: SEED_ID,
        publicKeySpkiDer: expected.publicKeySpkiDer,
        userId: 'yQtBRhu5QrCWGFFbDGtLPw==',
        userName: 'alice',
        displayName: 'Alice',
        createdAtMs: 1_760_000_000_000,
    }
}

const verifyWith = async (
    spkiDer: Uint8Array,
    data: Uint8Array,
    signature: Uint8Array,
): Promise<boolean> => {
    const publicKey = await subtle.importKey(
        'spki',
        spkiDer as BufferSource,
        { name: 'ECDSA', namedCurve: 'P-256' },
        false,
        ['verify'],
    )
    return subtle.verify(
        { name: 'ECDSA', hash: 'SHA-256' },
        publicKey,
        signature as BufferSource,
        data as BufferSource,
    )
}

describe('deriveEnginePasskeyEntry', () => {
    beforeEach(() => {
        engine.keystore = undefined
        engine.store = undefined
    })

    it('re-derives the backed-up credential under its seed and signs with it', async () => {
        const { keystore, store } = await startEngine()
        const params = await baseParams()

        const result = await deriveEnginePasskeyEntry(params)

        expect(result).toBe('written')
        const key = store.state.keys.find(k => k.id === params.credentialId)
        expect(key?.type).toBe('hd-derived-p256')
        expect(key?.metadata).toMatchObject({
            origin: ORIGIN,
            userHandle: IDENTITY,
            identity: IDENTITY,
            counter: 0,
            parentKeyId: `${SEED_ID}-passkey-main`,
            userHandleOriginal: 'yQtBRhu5QrCWGFFbDGtLPw',
            userId: params.userId,
            userName: 'alice',
            displayName: 'Alice',
            createdAt: params.createdAtMs,
        })

        const data = new TextEncoder().encode('assertion payload')
        const signature = await keystore.sign(params.credentialId, data)
        await expect(
            verifyWith(params.publicKeySpkiDer, data, signature),
        ).resolves.toBe(true)
    })

    it('reuses the seed main key rather than minting a second one', async () => {
        const { store } = await startEngine()
        await deriveEnginePasskeyEntry(await baseParams())
        const other = await expectedCredential('bob')

        await deriveEnginePasskeyEntry({
            ...(await baseParams()),
            credentialId: 'second-credential',
            identity: 'bob',
            publicKeySpkiDer: other.publicKeySpkiDer,
        })

        const mainKeys = store.state.keys.filter(
            k =>
                k.metadata?.scheme === 'pbkdf2-p256' &&
                k.type === 'hd-root-key',
        )
        expect(mainKeys.map(k => k.id)).toEqual([`${SEED_ID}-passkey-main`])
    })

    it('removes the key and reports a mismatch when the seed does not reproduce it', async () => {
        const { store } = await startEngine()
        const elsewhere = await expectedCredential('mallory')

        const result = await deriveEnginePasskeyEntry({
            ...(await baseParams()),
            publicKeySpkiDer: elsewhere.publicKeySpkiDer,
        })

        expect(result).toBe('pubkey-mismatch')
        expect(store.state.keys.some(k => k.id === 'restored-credential')).toBe(
            false,
        )
    })

    it('throws when the seed has no entropy child to derive from', async () => {
        await startEngine()

        await expect(
            deriveEnginePasskeyEntry({
                ...(await baseParams()),
                seedKeyId: 'unknown-seed',
            }),
        ).rejects.toThrow(/entropy/)
    })
})

describe('enginePasskeyEntryExists', () => {
    it('finds a credential by its id', async () => {
        await startEngine()
        const params = await baseParams()
        await deriveEnginePasskeyEntry(params)

        expect(
            enginePasskeyEntryExists(params.credentialId, new Uint8Array(91)),
        ).toBe(true)
    })

    it('finds the same credential registered here under another id', async () => {
        await startEngine()
        const params = await baseParams()
        await deriveEnginePasskeyEntry({
            ...params,
            credentialId: 'minted-here',
        })

        expect(
            enginePasskeyEntryExists(
                params.credentialId,
                params.publicKeySpkiDer,
            ),
        ).toBe(true)
    })

    it('is false for a credential this engine does not hold', async () => {
        await startEngine()
        const params = await baseParams()

        expect(
            enginePasskeyEntryExists(
                params.credentialId,
                params.publicKeySpkiDer,
            ),
        ).toBe(false)
    })
})

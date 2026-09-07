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
import { IDBFactory } from 'fake-indexeddb'
import { Store } from '@tanstack/store'
import Hook from 'before-after-hook'
import type { KeyStoreState } from '@algorandfoundation/keystore-core'
import {
    MASTER_KEY_ID,
    MATERIAL_STORE,
    openDatabase,
} from '@algorandfoundation/keystore-web'

// The default shims dynamically import WASM Falcon, XHD and dp256; none of
// that is under test and the Ed25519 path below runs on the host Subtle.
vi.mock('@algorandfoundation/keystore-core', async importOriginal => {
    const original =
        await importOriginal<typeof import('@algorandfoundation/keystore-core')>()
    return { ...original, createDefaultShims: () => [] }
})

import { createPeraKeystore } from '../createKeystore.web'
import { setEngineKeySource } from '../engineKeySource'

class TestVaultLockedError extends Error {}

const SESSION_KEY = Uint8Array.from({ length: 32 }, (_, i) => i + 1)
const SEED = Uint8Array.from({ length: 32 }, (_, i) => 255 - i)

const deps = () => ({
    store: new Store<KeyStoreState>({ keys: [], status: 'idle' }),
    hooks: new Hook.Collection(),
})

const materialKind = async (id: string): Promise<string | undefined> => {
    const db = await openDatabase('keystore', globalThis.indexedDB)
    try {
        return (await db.get<{ kind: string }>(MATERIAL_STORE, id))?.kind
    } finally {
        db.close()
    }
}

const ed25519PublicKey = async (seed: Uint8Array): Promise<Uint8Array> => {
    const pkcs8 = new Uint8Array(48)
    pkcs8.set(
        Uint8Array.of(
            0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65,
            0x70, 0x04, 0x22, 0x04, 0x20,
        ),
    )
    pkcs8.set(seed, 16)
    const key = await globalThis.crypto.subtle.importKey(
        'pkcs8',
        pkcs8,
        { name: 'Ed25519' },
        true,
        ['sign'],
    )
    const jwk = await globalThis.crypto.subtle.exportKey('jwk', key)
    return Uint8Array.from(
        Buffer.from(String(jwk.x).replace(/-/g, '+').replace(/_/g, '/'), 'base64'),
    )
}

const importAlgo25 = async (
    keystore: ReturnType<typeof createPeraKeystore>,
): Promise<void> => {
    await keystore.import(
        {
            id: 'seed-1',
            type: 'seed',
            algorithm: 'raw',
            extractable: true,
            keyUsages: ['deriveKey', 'deriveBits'],
            privateKey: Uint8Array.from(SEED),
            metadata: { scheme: 'algo25' },
        },
        'raw',
    )
    await keystore.import(
        {
            id: 'sign-1',
            type: 'ed25519',
            algorithm: 'EdDSA',
            extractable: false,
            keyUsages: ['sign', 'verify'],
            privateKey: Uint8Array.from(SEED),
            publicKey: await ed25519PublicKey(SEED),
            metadata: { parentKeyId: 'seed-1' },
        },
        'raw',
    )
}

describe('createPeraKeystore (web)', () => {
    let unlocked: boolean

    beforeEach(() => {
        globalThis.indexedDB = new IDBFactory()
        unlocked = true
        setEngineKeySource(async () => {
            if (!unlocked) throw new TestVaultLockedError('locked')
            return Uint8Array.from(SESSION_KEY)
        })
    })

    it('never writes __keystore.master__ and stores the Ed25519 child as sealed bytes', async () => {
        const keystore = createPeraKeystore(deps())
        await keystore.ready

        await importAlgo25(keystore)

        expect(await materialKind(MASTER_KEY_ID)).toBeUndefined()
        expect(await materialKind('seed-1')).toBe('bytes')
        expect(await materialKind('sign-1')).toBe('bytes')
    })

    it('signs with the byte-stored child', async () => {
        const keystore = createPeraKeystore(deps())
        await keystore.ready
        await importAlgo25(keystore)
        const data = Uint8Array.of(1, 2, 3)

        const signature = await keystore.sign('sign-1', data)

        const publicKey = await globalThis.crypto.subtle.importKey(
            'raw',
            await ed25519PublicKey(SEED),
            { name: 'Ed25519' },
            true,
            ['verify'],
        )
        expect(
            await globalThis.crypto.subtle.verify(
                { name: 'Ed25519' },
                publicKey,
                signature,
                data,
            ),
        ).toBe(true)
    })

    // The source's own error class must reach the caller untouched: the UI
    // routes on `instanceof VaultLockedError`.
    it('rejects every material operation with the source error while locked', async () => {
        const keystore = createPeraKeystore(deps())
        await keystore.ready
        await importAlgo25(keystore)
        const secretId = await keystore.secrets!.put('pin', { id: 'pin' })
        unlocked = false

        await expect(keystore.sign('sign-1', Uint8Array.of(1))).rejects.toBeInstanceOf(
            TestVaultLockedError,
        )
        await expect(keystore.export('seed-1')).rejects.toBeInstanceOf(
            TestVaultLockedError,
        )
        await expect(keystore.secrets!.get(secretId)).rejects.toBeInstanceOf(
            TestVaultLockedError,
        )
        await expect(
            keystore.import(
                {
                    id: 'seed-2',
                    type: 'seed',
                    algorithm: 'raw',
                    extractable: true,
                    keyUsages: ['deriveKey', 'deriveBits'],
                    privateKey: Uint8Array.from(SEED),
                },
                'raw',
            ),
        ).rejects.toBeInstanceOf(TestVaultLockedError)
    })

    it('locking mid-session stops the next operation without a restart', async () => {
        const keystore = createPeraKeystore(deps())
        await keystore.ready
        await importAlgo25(keystore)
        await keystore.sign('sign-1', Uint8Array.of(1))

        unlocked = false
        await expect(keystore.sign('sign-1', Uint8Array.of(1))).rejects.toBeInstanceOf(
            TestVaultLockedError,
        )

        unlocked = true
        await expect(keystore.sign('sign-1', Uint8Array.of(1))).resolves.toHaveLength(64)
    })

    it('flips nativeCryptoKey off with and without a before gate', async () => {
        const gated = createPeraKeystore({ ...deps(), before: Promise.resolve() })
        await gated.ready
        await importAlgo25(gated)
        expect(await materialKind('sign-1')).toBe('bytes')

        globalThis.indexedDB = new IDBFactory()
        const ungated = createPeraKeystore(deps())
        await ungated.ready
        await importAlgo25(ungated)
        expect(await materialKind('sign-1')).toBe('bytes')
    })
})

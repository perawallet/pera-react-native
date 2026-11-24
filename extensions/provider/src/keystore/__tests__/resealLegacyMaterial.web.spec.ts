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
import { createKeyStore } from '@algorandfoundation/keystore-core'
import type { KeyStoreState } from '@algorandfoundation/keystore-core'
import {
    MASTER_KEY_ID,
    MATERIAL_STORE,
    createIndexedDBDriver,
    open,
    openDatabase,
    seal,
    type MaterialRecord,
} from '@algorandfoundation/keystore-web'

vi.mock('@algorandfoundation/keystore-core', async importOriginal => {
    const original =
        await importOriginal<
            typeof import('@algorandfoundation/keystore-core')
        >()
    return { ...original, createDefaultShims: () => [] }
})

import { createPeraKeystore } from '../createKeystore.web'
import { setEngineKeySource } from '../engineKeySource'
import {
    checkLegacyMaterialWith,
    discardLegacyKeyWith,
    resealLegacyMaterialWith,
} from '../resealLegacyMaterial.web'
import { safeWarn } from '../migrations/safeLog'

vi.mock('../migrations/safeLog', () => ({ safeWarn: vi.fn() }))

const subtle = globalThis.crypto.subtle
const SESSION_KEY = Uint8Array.from({ length: 32 }, (_, i) => i + 1)
const SEED = Uint8Array.from({ length: 32 }, (_, i) => 255 - i)

const ed25519PublicKey = async (seed: Uint8Array): Promise<Uint8Array> => {
    const pkcs8 = new Uint8Array(48)
    pkcs8.set(
        Uint8Array.of(
            0x30,
            0x2e,
            0x02,
            0x01,
            0x00,
            0x30,
            0x05,
            0x06,
            0x03,
            0x2b,
            0x65,
            0x70,
            0x04,
            0x22,
            0x04,
            0x20,
        ),
    )
    pkcs8.set(seed, 16)
    const key = await subtle.importKey(
        'pkcs8',
        pkcs8,
        { name: 'Ed25519' },
        true,
        ['sign'],
    )
    const jwk = await subtle.exportKey('jwk', key)
    return Uint8Array.from(
        Buffer.from(
            String(jwk.x).replace(/-/g, '+').replace(/_/g, '/'),
            'base64',
        ),
    )
}

const store = () => new Store<KeyStoreState>({ keys: [], status: 'idle' })

// A profile written by the driver as shipped before this change: material
// sealed under the auto-generated `__keystore.master__`, and the Ed25519
// child stored as a native CryptoKey.
const writeLegacyProfile = async (factory: IDBFactory): Promise<void> => {
    const legacy = createKeyStore({
        driver: createIndexedDBDriver({ host: subtle, indexedDB: factory }),
        store: store(),
        subtle,
        shims: [],
    })
    await legacy.ready
    await legacy.import(
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
    await legacy.import(
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
    await legacy.secrets!.put('1234', { id: 'pin' })
}

const readMaterial = async (
    factory: IDBFactory,
    id: string,
): Promise<MaterialRecord | undefined> => {
    const db = await openDatabase('keystore', factory)
    try {
        return await db.get<MaterialRecord>(MATERIAL_STORE, id)
    } finally {
        db.close()
    }
}

const engineKey = (): Promise<CryptoKey> =>
    subtle.importKey('raw', SESSION_KEY, { name: 'AES-GCM' }, false, [
        'encrypt',
        'decrypt',
    ])

const opensUnderEngine = async (
    factory: IDBFactory,
    id: string,
): Promise<boolean> => {
    const record = await readMaterial(factory, id)
    if (!record || record.kind !== 'bytes') return false
    try {
        await open(subtle, await engineKey(), record)
        return true
    } catch {
        return false
    }
}

const ATTACKER_SEED = Uint8Array.from({ length: 32 }, () => 0xaa)

describe('legacy keystore material', () => {
    let factory: IDBFactory
    let keystore: ReturnType<typeof createPeraKeystore>
    let resolveEngineKey: ReturnType<typeof vi.fn<() => Promise<CryptoKey>>>

    const resealDeps = async () => ({
        engineKey: await engineKey(),
        subtle,
        indexedDB: factory,
        databaseName: 'keystore',
    })

    const checkDeps = () => ({
        keystore,
        resolveEngineKey,
        subtle,
        indexedDB: factory,
        databaseName: 'keystore',
    })

    const corrupt = async (id: string): Promise<void> => {
        const db = await openDatabase('keystore', factory)
        const record = (await db.get<MaterialRecord>(MATERIAL_STORE, id))!
        if (record.kind !== 'bytes') throw new Error('fixture')
        record.ciphertext[0] ^= 0xff
        await db.put(MATERIAL_STORE, record)
        db.close()
    }

    beforeEach(async () => {
        vi.mocked(safeWarn).mockClear()
        factory = new IDBFactory()
        globalThis.indexedDB = factory
        setEngineKeySource(async () => Uint8Array.from(SESSION_KEY))
        resolveEngineKey = vi.fn(engineKey)
        await writeLegacyProfile(factory)
        keystore = createPeraKeystore({
            store: store(),
            hooks: new Hook.Collection(),
        })
        await keystore.ready
    })

    describe('resealLegacyMaterialWith', () => {
        it('re-seals bytes and deletes the legacy key', async () => {
            expect(await opensUnderEngine(factory, 'seed-1')).toBe(false)

            const report = await resealLegacyMaterialWith(await resealDeps())

            expect(report).toEqual({
                resealed: 2,
                unrecoverable: [],
                legacyKeyRemoved: true,
            })
            expect(await opensUnderEngine(factory, 'seed-1')).toBe(true)
            expect(await opensUnderEngine(factory, 'pin')).toBe(true)
            expect(await readMaterial(factory, MASTER_KEY_ID)).toBeUndefined()
        })

        it('is a no-op once the legacy key is gone, and does not resurrect it', async () => {
            await resealLegacyMaterialWith(await resealDeps())

            const report = await resealLegacyMaterialWith(await resealDeps())

            expect(report).toEqual({
                resealed: 0,
                unrecoverable: [],
                legacyKeyRemoved: false,
            })
            expect(await readMaterial(factory, MASTER_KEY_ID)).toBeUndefined()
        })

        it('converges when two sweeps interleave', async () => {
            const [a, b] = await Promise.all([
                resealLegacyMaterialWith(await resealDeps()),
                resealLegacyMaterialWith(await resealDeps()),
            ])
            await checkLegacyMaterialWith(checkDeps())

            expect(a.resealed + b.resealed).toBeGreaterThanOrEqual(2)
            expect(a.unrecoverable).toEqual([])
            expect(b.unrecoverable).toEqual([])
            expect(await opensUnderEngine(factory, 'seed-1')).toBe(true)
            expect(await opensUnderEngine(factory, 'pin')).toBe(true)
            expect(await readMaterial(factory, MASTER_KEY_ID)).toBeUndefined()
            await expect(
                keystore.sign('sign-1', Uint8Array.of(1)),
            ).resolves.toHaveLength(64)
        })

        it('logs a record that opens under neither key, leaves it, and still removes the legacy key', async () => {
            await corrupt('pin')

            const report = await resealLegacyMaterialWith(await resealDeps())

            expect(report.unrecoverable).toEqual(['pin'])
            expect(report.legacyKeyRemoved).toBe(true)
            expect(await opensUnderEngine(factory, 'seed-1')).toBe(true)
            expect(await opensUnderEngine(factory, 'pin')).toBe(false)
            expect(vi.mocked(safeWarn)).toHaveBeenCalledWith(
                expect.stringContaining('pin'),
            )
            expect(vi.mocked(safeWarn).mock.calls.join(' ')).not.toContain(
                '1234',
            )
        })

        it('removes only the legacy key from a profile whose records are all engine-sealed', async () => {
            await resealLegacyMaterialWith(await resealDeps())
            // `driver.clear()` preserves the reserved id, so a wipe between the
            // upgrade and a completed sweep looks like this: legacy key present,
            // everything else already engine-sealed.
            const legacy = createIndexedDBDriver({
                host: subtle,
                indexedDB: factory,
            })
            await legacy.ready
            expect((await readMaterial(factory, MASTER_KEY_ID))?.kind).toBe(
                'cryptokey',
            )

            const report = await resealLegacyMaterialWith(await resealDeps())

            expect(report).toEqual({
                resealed: 0,
                unrecoverable: [],
                legacyKeyRemoved: true,
            })
            expect(await readMaterial(factory, MASTER_KEY_ID)).toBeUndefined()
            expect(await opensUnderEngine(factory, 'seed-1')).toBe(true)
        })
    })

    describe('discardLegacyKeyWith', () => {
        const plantKeyBesideSwappedRoot = async (): Promise<void> => {
            const plantedKey = await subtle.generateKey(
                { name: 'AES-GCM', length: 256 },
                false,
                ['encrypt', 'decrypt'],
            )
            const sealed = await seal(subtle, plantedKey, ATTACKER_SEED)
            const db = await openDatabase('keystore', factory)
            await db.put<MaterialRecord>(MATERIAL_STORE, {
                id: MASTER_KEY_ID,
                kind: 'cryptokey',
                privateKey: plantedKey,
            })
            await db.put<MaterialRecord>(MATERIAL_STORE, {
                id: 'seed-1',
                kind: 'bytes',
                ...sealed,
            })
            db.close()
        }

        it('deletes a key planted beside a swapped root, reporting the root and re-sealing nothing', async () => {
            await resealLegacyMaterialWith(await resealDeps())
            await checkLegacyMaterialWith(checkDeps())
            await plantKeyBesideSwappedRoot()

            const report = await discardLegacyKeyWith(await resealDeps())

            expect(report).toEqual({
                unrecoverable: ['seed-1'],
                legacyKeyRemoved: true,
            })
            expect(await readMaterial(factory, MASTER_KEY_ID)).toBeUndefined()
            expect(await opensUnderEngine(factory, 'seed-1')).toBe(false)
            expect(await opensUnderEngine(factory, 'pin')).toBe(true)
            expect(await checkLegacyMaterialWith(checkDeps())).toEqual({
                reminted: 0,
                unrecoverable: [],
            })
        })

        it('deletes a key orphaned by a reset that kept the reserved id', async () => {
            await resealLegacyMaterialWith(await resealDeps())
            const legacy = createIndexedDBDriver({
                host: subtle,
                indexedDB: factory,
            })
            await legacy.ready

            const report = await discardLegacyKeyWith(await resealDeps())

            expect(report).toEqual({
                unrecoverable: [],
                legacyKeyRemoved: true,
            })
            expect(await readMaterial(factory, MASTER_KEY_ID)).toBeUndefined()
        })

        it('does nothing without a legacy key', async () => {
            await resealLegacyMaterialWith(await resealDeps())

            const report = await discardLegacyKeyWith(await resealDeps())

            expect(report).toEqual({
                unrecoverable: [],
                legacyKeyRemoved: false,
            })
        })
    })

    describe('checkLegacyMaterialWith', () => {
        it('re-mints the child as bytes once its parent is re-sealed, and it still signs for the same public key', async () => {
            await resealLegacyMaterialWith(await resealDeps())
            expect((await readMaterial(factory, 'sign-1'))?.kind).toBe(
                'cryptokey',
            )

            const report = await checkLegacyMaterialWith(checkDeps())

            expect(report).toEqual({ reminted: 1, unrecoverable: [] })
            expect(await opensUnderEngine(factory, 'sign-1')).toBe(true)
            const data = Uint8Array.of(4, 5, 6)
            const signature = await keystore.sign('sign-1', data)
            const publicKey = await subtle.importKey(
                'raw',
                await ed25519PublicKey(SEED),
                { name: 'Ed25519' },
                true,
                ['verify'],
            )
            expect(
                await subtle.verify(
                    { name: 'Ed25519' },
                    publicKey,
                    signature,
                    data,
                ),
            ).toBe(true)
            expect(await keystore.secrets!.get('pin')).toEqual(
                new TextEncoder().encode('1234'),
            )
        })

        it('costs no engine key on a fully migrated profile', async () => {
            await resealLegacyMaterialWith(await resealDeps())
            await checkLegacyMaterialWith(checkDeps())
            resolveEngineKey.mockClear()

            const report = await checkLegacyMaterialWith(checkDeps())

            expect(report).toEqual({ reminted: 0, unrecoverable: [] })
            expect(resolveEngineKey).not.toHaveBeenCalled()
        })

        it('reports a child whose parent seed did not re-seal, and leaves it as a CryptoKey', async () => {
            await corrupt('seed-1')
            const reseal = await resealLegacyMaterialWith(await resealDeps())

            const report = await checkLegacyMaterialWith(checkDeps())

            expect(reseal.unrecoverable).toEqual(['seed-1'])
            expect(reseal.legacyKeyRemoved).toBe(true)
            expect(report).toEqual({ reminted: 0, unrecoverable: ['sign-1'] })
            expect(await opensUnderEngine(factory, 'pin')).toBe(true)
            expect((await readMaterial(factory, 'sign-1'))?.kind).toBe(
                'cryptokey',
            )
            expect(vi.mocked(safeWarn).mock.calls.join(' ')).not.toContain(
                String.fromCharCode(...SEED),
            )
        })

        it('re-mints a leftover child on a later run after the legacy key is gone', async () => {
            await corrupt('seed-1')
            await resealLegacyMaterialWith(await resealDeps())
            await checkLegacyMaterialWith(checkDeps())
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

            const report = await checkLegacyMaterialWith(checkDeps())

            expect(report).toEqual({ reminted: 1, unrecoverable: [] })
            expect((await readMaterial(factory, 'sign-1'))?.kind).toBe('bytes')
            await expect(
                keystore.sign('sign-1', Uint8Array.of(1)),
            ).resolves.toHaveLength(64)
        })

        it('does not adopt a root swapped in beside a reappearing legacy key', async () => {
            await resealLegacyMaterialWith(await resealDeps())
            await checkLegacyMaterialWith(checkDeps())
            // A profile writer without the password plants a legacy key and
            // swaps the root for one sealed under it.
            const plantedKey = await subtle.generateKey(
                { name: 'AES-GCM', length: 256 },
                false,
                ['encrypt', 'decrypt'],
            )
            const sealed = await seal(subtle, plantedKey, ATTACKER_SEED)
            const db = await openDatabase('keystore', factory)
            await db.put<MaterialRecord>(MATERIAL_STORE, {
                id: MASTER_KEY_ID,
                kind: 'cryptokey',
                privateKey: plantedKey,
            })
            await db.put<MaterialRecord>(MATERIAL_STORE, {
                id: 'seed-1',
                kind: 'bytes',
                ...sealed,
            })
            db.close()

            // The vault's mark keeps the unlock from re-sealing; startup runs.
            const report = await checkLegacyMaterialWith(checkDeps())

            expect(report).toEqual({ reminted: 0, unrecoverable: ['seed-1'] })
            expect(await opensUnderEngine(factory, 'seed-1')).toBe(false)
            await expect(keystore.export('seed-1')).rejects.toThrow()
            expect(await opensUnderEngine(factory, 'pin')).toBe(true)
            expect(await opensUnderEngine(factory, 'sign-1')).toBe(true)
            expect((await readMaterial(factory, MASTER_KEY_ID))?.kind).toBe(
                'cryptokey',
            )
            expect(vi.mocked(safeWarn)).toHaveBeenCalledWith(
                expect.stringContaining('seed-1'),
            )
        })
    })
})

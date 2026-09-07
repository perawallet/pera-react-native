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

import { describe, expect, it, vi } from 'vitest'
import { IDBFactory } from 'fake-indexeddb'
import {
    MASTER_KEY_ID,
    MATERIAL_STORE,
    createIndexedDBDriver,
    openDatabase,
} from '@algorandfoundation/keystore-web'

const subtle = globalThis.crypto.subtle

const aesKey = (): Promise<CryptoKey> =>
    subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, [
        'encrypt',
        'decrypt',
    ])

const readMaterial = async (
    factory: IDBFactory,
    id: string,
): Promise<{ kind: string } | undefined> => {
    const db = await openDatabase('keystore', factory)
    try {
        return await db.get<{ kind: string }>(MATERIAL_STORE, id)
    } finally {
        db.close()
    }
}

describe('createIndexedDBDriver with a masterKey provider', () => {
    it('never writes __keystore.master__ and round-trips bytes', async () => {
        const factory = new IDBFactory()
        const key = await aesKey()
        const driver = createIndexedDBDriver({
            host: subtle,
            indexedDB: factory,
            masterKey: async () => key,
        })
        await driver.ready

        await driver.put('k1', { kind: 'bytes', bytes: Uint8Array.of(1, 2, 3) })
        const seen = await driver.use('k1', undefined, m =>
            m.kind === 'bytes' ? Array.from(m.bytes) : null,
        )

        expect(seen).toEqual([1, 2, 3])
        expect(await readMaterial(factory, MASTER_KEY_ID)).toBeUndefined()
        expect((await readMaterial(factory, 'k1'))?.kind).toBe('bytes')
    })

    // The whole mechanism: the key is asked for on every seal and open, so a
    // provider that starts throwing (a lock) stops the next operation without
    // a restart.
    it('resolves the key per operation and propagates the provider rejection', async () => {
        const factory = new IDBFactory()
        const key = await aesKey()
        const locked = new Error('locked')
        const provider = vi.fn(async () => key)
        const driver = createIndexedDBDriver({
            host: subtle,
            indexedDB: factory,
            masterKey: provider,
        })
        await driver.ready

        await driver.put('k1', { kind: 'bytes', bytes: Uint8Array.of(9) })
        await driver.use('k1', undefined, () => undefined)
        expect(provider).toHaveBeenCalledTimes(2)

        provider.mockRejectedValue(locked)
        await expect(
            driver.use('k1', undefined, () => undefined),
        ).rejects.toBe(locked)
        await expect(
            driver.put('k2', { kind: 'bytes', bytes: Uint8Array.of(1) }),
        ).rejects.toBe(locked)
    })

    it('ready does not call the provider', async () => {
        const provider = vi.fn<() => Promise<CryptoKey>>()
        const driver = createIndexedDBDriver({
            host: subtle,
            indexedDB: new IDBFactory(),
            masterKey: provider,
        })

        await driver.ready

        expect(provider).not.toHaveBeenCalled()
    })

    it('keeps the auto-generated key when no provider is supplied', async () => {
        const factory = new IDBFactory()
        const driver = createIndexedDBDriver({ host: subtle, indexedDB: factory })

        await driver.ready

        expect((await readMaterial(factory, MASTER_KEY_ID))?.kind).toBe(
            'cryptokey',
        )
    })

    it('never consults the provider for cryptokey material or metadata paths', async () => {
        const provider = vi.fn<() => Promise<CryptoKey>>()
        const driver = createIndexedDBDriver({
            host: subtle,
            indexedDB: new IDBFactory(),
            masterKey: provider,
        })
        await driver.ready
        const privateKey = await aesKey()

        await driver.put('ck', { kind: 'cryptokey', privateKey })
        await driver.use('ck', undefined, m => m.kind)
        await driver.putMeta({
            id: 'ck',
            type: 'raw',
            algorithm: 'AES-GCM',
            extractable: false,
        })
        await driver.getMeta('ck')
        await driver.listMeta()
        await driver.remove('ck')
        await driver.clear()

        expect(provider).not.toHaveBeenCalled()
    })
})

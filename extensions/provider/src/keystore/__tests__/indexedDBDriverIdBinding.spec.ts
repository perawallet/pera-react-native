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

import { describe, expect, it } from 'vitest'
import { IDBFactory } from 'fake-indexeddb'
import {
    MATERIAL_STORE,
    createIndexedDBDriver,
    open,
    openDatabase,
    seal,
    type MaterialRecord,
} from '@algorandfoundation/keystore-web'

const subtle = globalThis.crypto.subtle

const aesKey = (): Promise<CryptoKey> =>
    subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, [
        'encrypt',
        'decrypt',
    ])

const withDb = async <T>(
    factory: IDBFactory,
    fn: (db: Awaited<ReturnType<typeof openDatabase>>) => Promise<T>,
): Promise<T> => {
    const db = await openDatabase('keystore', factory)
    try {
        return await fn(db)
    } finally {
        db.close()
    }
}

const readBytesRecord = (factory: IDBFactory, id: string) =>
    withDb(factory, async db => {
        const record = await db.get<MaterialRecord>(MATERIAL_STORE, id)
        if (record?.kind !== 'bytes') throw new Error(`no bytes record ${id}`)
        return record
    })

const setup = async () => {
    const factory = new IDBFactory()
    const key = await aesKey()
    const driver = createIndexedDBDriver({
        host: subtle,
        indexedDB: factory,
        masterKey: async () => key,
    })
    await driver.ready
    const read = (id: string) =>
        driver.use(id, undefined, m =>
            m.kind === 'bytes' ? Array.from(m.bytes) : null,
        )
    return { factory, key, driver, read }
}

describe('createIndexedDBDriver id binding', () => {
    it('refuses a record moved under another id', async () => {
        const { factory, driver, read } = await setup()
        await driver.put('a', { kind: 'bytes', bytes: Uint8Array.of(1) })
        await driver.put('b', { kind: 'bytes', bytes: Uint8Array.of(2) })

        // A copied profile with b's sealed bytes written into a's row.
        const recordB = await readBytesRecord(factory, 'b')
        await withDb(factory, db =>
            db.put<MaterialRecord>(MATERIAL_STORE, { ...recordB, id: 'a' }),
        )

        await expect(read('a')).rejects.toThrow()
        expect(await read('b')).toEqual([2])
    })

    it('opens a record sealed before ids were bound and re-seals it bound', async () => {
        const { factory, key, read } = await setup()
        const unbound = await seal(subtle, key, Uint8Array.of(7, 8))
        await withDb(factory, db =>
            db.put<MaterialRecord>(MATERIAL_STORE, {
                id: 'old',
                kind: 'bytes',
                ...unbound,
            }),
        )

        expect(await read('old')).toEqual([7, 8])

        const resealed = await readBytesRecord(factory, 'old')
        expect(Array.from(await open(subtle, key, resealed, 'old'))).toEqual([
            7, 8,
        ])
        await expect(open(subtle, key, resealed)).rejects.toThrow()
    })
})

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

import { Store } from '@tanstack/store'
import type { KeyData, KeyStoreState } from '../../keystore'
import { beforeEach, describe, expect, it } from 'vitest'
import { createChromeFake, type ChromeFake } from '../../test-utils/chrome'
import { createVault, lockVault } from '../../vault/vault'
import { hydrateKeystoreStorage, storage } from '../chrome-storage'
import { commit, decode, encode, fetchSecret, removeSecret } from '../state'
import { VaultLockedError } from '../../errors'

const makeStore = (): Store<KeyStoreState> =>
    new Store<KeyStoreState>({ keys: [], status: 'idle' })

const makeKeyData = (): KeyData =>
    ({
        id: 'key-1',
        type: 'ed25519',
        algorithm: 'EdDSA',
        extractable: false,
        keyUsages: ['sign'],
        publicKey: new Uint8Array([1, 2, 3]),
        privateKey: new Uint8Array([4, 5, 6]),
    }) as KeyData

describe('keystore state', () => {
    let fake: ChromeFake

    beforeEach(async () => {
        fake = createChromeFake()
        globalThis.chrome = fake.chrome
        // Reset the singleton cache so each test starts with a fresh hydration
        // against the new fake chrome instance.
        storage.resetForTesting()
        await hydrateKeystoreStorage()
        for (const key of storage.getAllKeys()) storage.remove(key)
        await createVault('pw')
    })

    it('encode/decode round-trips KeyData with Uint8Array fields', () => {
        const decoded = decode(encode(makeKeyData()))
        expect(decoded.id).toBe('key-1')
        expect(decoded.publicKey).toEqual(new Uint8Array([1, 2, 3]))
        expect(decoded.privateKey).toEqual(new Uint8Array([4, 5, 6]))
    })

    it('commit encrypts to storage, strips private material, updates the store', async () => {
        const store = makeStore()
        const keyData = makeKeyData()
        await commit({ store, keyData })
        expect(keyData.privateKey).toBeUndefined()
        expect(store.state.keys).toHaveLength(1)
        expect(store.state.keys[0]?.id).toBe('key-1')
        const persisted = storage.getString('key-1')
        expect(persisted).toBeDefined()
        expect(persisted).not.toContain('4,5,6')
        expect(fake.data.has('keystore:key-1')).toBe(true)
    })

    it('fetchSecret decrypts a committed entry (and null for missing)', async () => {
        const store = makeStore()
        await commit({ store, keyData: makeKeyData() })
        const secret = await fetchSecret<KeyData>({ keyId: 'key-1' })
        expect(secret?.privateKey).toEqual(new Uint8Array([4, 5, 6]))
        expect(await fetchSecret({ keyId: 'nope' })).toBeNull()
    })

    it('removeSecret deletes the entry', async () => {
        const store = makeStore()
        await commit({ store, keyData: makeKeyData() })
        await removeSecret({ keyId: 'key-1' })
        expect(storage.getString('key-1')).toBeUndefined()
    })

    it('commit rejects KeyData without an id', async () => {
        const store = makeStore()
        const { id: _id, ...noId } = makeKeyData()
        await expect(
            commit({ store, keyData: noId as KeyData }),
        ).rejects.toThrow(/ID before committing/)
    })

    it('rejects commit when the storage write fails', async () => {
        // Stub chrome.storage.local.set to reject after hydration so the
        // in-memory cache is ready but the persistence layer is broken.
        fake.chrome.storage.local.set = async () => {
            throw new Error('quota')
        }
        const store = makeStore()
        await expect(commit({ store, keyData: makeKeyData() })).rejects.toThrow(
            'quota',
        )
        // The store must not reflect the key — the write never persisted.
        expect(store.state.keys).toHaveLength(0)
    })

    it('rejects commit with VaultLockedError when the vault is locked, without writing', async () => {
        await lockVault()
        const store = makeStore()
        const keyData = makeKeyData()
        const storedBefore = new Map(fake.data)
        await expect(
            commit({ store, keyData, options: undefined }),
        ).rejects.toBeInstanceOf(VaultLockedError)
        expect(fake.data).toEqual(storedBefore)
        expect(store.state.keys).toHaveLength(0)
        expect(store.state.status).toBe('idle') // finally resets status
    })
})

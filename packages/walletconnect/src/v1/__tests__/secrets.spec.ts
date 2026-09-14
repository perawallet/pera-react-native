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

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { commitSecret } from '@perawallet/wallet-core-kms'

const store = new Map<string, Uint8Array>()

vi.mock('@perawallet/wallet-core-kms', () => ({
    commitSecret: vi.fn(
        async ({ id, bytes }: { id: string; bytes: Uint8Array }) => {
            // The real commitSecret copies; secrets.ts zeroes `bytes` right
            // after, so aliasing the reference here would corrupt the value.
            store.set(id, new Uint8Array(bytes))
        },
    ),
    hasSecret: vi.fn((id: string) => store.has(id)),
    withSecret: vi.fn(
        async (id: string, handler: (b: Uint8Array) => unknown) =>
            store.has(id) ? handler(store.get(id)!) : null,
    ),
    removeSecret: vi.fn(async (id: string) => void store.delete(id)),
    zeroBytes: vi.fn((bytes: Uint8Array) => bytes.fill(0)),
}))

const {
    commitSessionKey,
    createKeystoreSessionKeyStore,
    createStorageSessionKeyStore,
    sessionKeySecretRef,
} = await import('../secrets')

describe('v1 session key storage', () => {
    it('namespaces the secret ref by client id', () => {
        expect(sessionKeySecretRef('abc')).toBe('wc1-session-key:abc')
    })

    describe('keystore store', () => {
        const keys = createKeystoreSessionKeyStore()

        beforeEach(() => {
            store.clear()
            vi.clearAllMocks()
        })

        it('round-trips a hex session key', async () => {
            await keys.commit('abc', 'deadbeef')

            expect(keys.has('abc')).toBe(true)
            expect(await keys.read('abc')).toBe('deadbeef')
        })

        it('reads null for an unknown client id rather than throwing', async () => {
            expect(keys.has('missing')).toBe(false)
            expect(await keys.read('missing')).toBeNull()
        })

        it('is idempotent — a second commit does not duplicate', async () => {
            const first = await keys.commit('abc', 'deadbeef')
            const second = await keys.commit('abc', 'deadbeef')

            expect(first).toBe(second)
            expect(first).toBe('wc1-session-key:abc')
            // Map.set on an existing key never changes size, so only the call
            // count proves the hasSecret guard ran.
            expect(commitSecret).toHaveBeenCalledTimes(1)
        })

        it('removes cleanly', async () => {
            await keys.commit('abc', 'deadbeef')
            await keys.remove('abc')

            expect(await keys.read('abc')).toBeNull()
        })

        it('commitSessionKey is the keystore commit', async () => {
            const ref = await commitSessionKey('abc', 'deadbeef')

            expect(ref).toBe('wc1-session-key:abc')
            expect(await keys.read('abc')).toBe('deadbeef')
        })
    })

    describe('storage store', () => {
        const makeStorage = () => {
            const map = new Map<string, string>()
            return {
                map,
                trim: vi.fn(),
                getItem: (k: string) => map.get(k) ?? null,
                setItem: (k: string, v: string) => void map.set(k, v),
                removeItem: (k: string) => void map.delete(k),
            }
        }

        it('round-trips a session key under the secret ref', async () => {
            const storage = makeStorage()
            const keys = createStorageSessionKeyStore(storage)

            const ref = await keys.commit('abc', 'deadbeef')

            expect(ref).toBe('wc1-session-key:abc')
            expect(storage.map.get('wc1-session-key:abc')).toBe('deadbeef')
            expect(keys.has('abc')).toBe(true)
            expect(await keys.read('abc')).toBe('deadbeef')
        })

        it('reports an absent key as missing', async () => {
            const keys = createStorageSessionKeyStore(makeStorage())

            expect(keys.has('missing')).toBe(false)
            expect(await keys.read('missing')).toBeNull()
        })

        it('does not overwrite an already committed key', async () => {
            const storage = makeStorage()
            const keys = createStorageSessionKeyStore(storage)

            await keys.commit('abc', 'deadbeef')
            await keys.commit('abc', 'cafebabe')

            expect(await keys.read('abc')).toBe('deadbeef')
        })

        it('remove deletes the key and trims the append log', async () => {
            const storage = makeStorage()
            const keys = createStorageSessionKeyStore(storage)
            await keys.commit('abc', 'deadbeef')

            await keys.remove('abc')

            expect(keys.has('abc')).toBe(false)
            expect(storage.trim).toHaveBeenCalledTimes(1)
        })

        it('remove tolerates a persistence with no trim', async () => {
            const { trim: _trim, ...storage } = makeStorage()
            const keys = createStorageSessionKeyStore(storage)
            await keys.commit('abc', 'deadbeef')

            await expect(keys.remove('abc')).resolves.toBeUndefined()
        })
    })
})

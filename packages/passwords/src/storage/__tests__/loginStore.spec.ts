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

const secrets = new Map<string, Uint8Array>()
const metadata = new Map<string, Record<string, unknown>>()

vi.mock('@perawallet/wallet-core-kms', () => ({
    commitSecret: vi.fn(
        async (params: {
            id: string
            bytes: Uint8Array
            metadata?: Record<string, unknown>
        }) => {
            secrets.set(params.id, new Uint8Array(params.bytes))
            metadata.set(params.id, params.metadata ?? {})
        },
    ),
    withSecret: vi.fn(
        async <T>(id: string, handler: (bytes: Uint8Array) => T) => {
            const bytes = secrets.get(id)
            if (!bytes) return null
            return handler(new Uint8Array(bytes))
        },
    ),
    removeSecret: vi.fn(async (id: string) => {
        secrets.delete(id)
        metadata.delete(id)
    }),
}))

vi.mock('@perawallet/wallet-extension-provider', () => ({
    getKeystoreStore: () => ({
        state: {
            keys: [...metadata.entries()].map(([id, meta]) => ({
                id,
                type: 'secret-key',
                metadata: meta,
            })),
        },
    }),
}))

import { deleteLogin, listLogins, readLogin, saveLogin } from '../loginStore'

const input = {
    domain: 'example.com',
    username: 'ada@example.com',
    password: 'correct horse battery staple',
    note: null,
}

describe('loginStore', () => {
    beforeEach(() => {
        secrets.clear()
        metadata.clear()
    })

    it('creates a login and lists it without the password', async () => {
        const created = await saveLogin(input, 1_700_000_000_000)

        expect(created.id.startsWith('pera.login.')).toBe(true)
        expect(await listLogins()).toEqual([
            {
                id: created.id,
                domain: 'example.com',
                username: 'ada@example.com',
                note: null,
                createdAt: 1_700_000_000_000,
                updatedAt: 1_700_000_000_000,
            },
        ])
    })

    it('reads the password back only through readLogin', async () => {
        const created = await saveLogin(input, 1_700_000_000_000)

        const read = await readLogin(created.id)

        expect(read?.password).toBe('correct horse battery staple')
    })

    it('seals every field except the discriminator', async () => {
        const created = await saveLogin(input, 1_700_000_000_000)

        expect(metadata.get(created.id)).toEqual({ kind: 'login', v: 1 })
    })

    it('updates in place, preserving createdAt and advancing updatedAt', async () => {
        const created = await saveLogin(input, 1_700_000_000_000)

        const updated = await saveLogin(
            { ...input, id: created.id, password: 'new-secret' },
            1_700_000_009_999,
        )

        expect(updated.id).toBe(created.id)
        expect(updated.createdAt).toBe(1_700_000_000_000)
        expect(updated.updatedAt).toBe(1_700_000_009_999)
        expect((await readLogin(created.id))?.password).toBe('new-secret')
        expect(await listLogins()).toHaveLength(1)
    })

    it('deletes a login', async () => {
        const created = await saveLogin(input, 1_700_000_000_000)

        await deleteLogin(created.id)

        expect(await listLogins()).toEqual([])
        expect(await readLogin(created.id)).toBeNull()
    })

    it('ignores non-login secrets sharing the keystore', async () => {
        metadata.set('pera.pinCode', {})
        secrets.set('pera.pinCode', new Uint8Array([1, 2, 3]))

        await saveLogin(input, 1_700_000_000_000)

        expect(await listLogins()).toHaveLength(1)
    })

    it('skips a login record whose payload cannot be decoded', async () => {
        metadata.set('pera.login.broken', { kind: 'login', v: 1 })
        secrets.set('pera.login.broken', new TextEncoder().encode('not json'))

        expect(await listLogins()).toEqual([])
    })
})

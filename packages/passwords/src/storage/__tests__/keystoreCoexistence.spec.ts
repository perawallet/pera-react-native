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

import { isLoginKey } from '../../models/login'

// vi.mock factories run before the rest of this module is evaluated, so
// the shared record map can only be threaded in via vi.hoisted.
const { records } = vi.hoisted(() => ({
    records: new Map<string, Record<string, unknown>>(),
}))

vi.mock('@perawallet/wallet-core-kms', () => ({
    commitSecret: vi.fn(
        async (params: { id: string; metadata?: Record<string, unknown> }) => {
            records.set(params.id, params.metadata ?? {})
        },
    ),
    withSecret: vi.fn(async () => null),
    removeSecret: vi.fn(async (id: string) => {
        records.delete(id)
    }),
}))

vi.mock('@perawallet/wallet-extension-provider', () => ({
    getKeystoreStore: () => ({
        state: {
            keys: [...records.entries()].map(([id, metadata]) => ({
                id,
                type: 'secret-key',
                metadata,
            })),
        },
    }),
}))

import { saveLogin } from '../loginStore'

describe('login records coexisting with key material', () => {
    beforeEach(() => {
        records.clear()
    })

    it('is not counted as a signing key by an isLoginKey-unaware consumer', async () => {
        records.set('pera.pinCode', {})
        records.set('hd-root', { scheme: 'bip32-ed25519' })

        await saveLogin(
            {
                domain: 'example.com',
                username: 'ada@example.com',
                password: 'secret',
                note: null,
            },
            1,
        )

        const keys = [...records.entries()].map(([id, metadata]) => ({
            id,
            type: 'secret-key',
            metadata,
        }))

        expect(keys.filter(key => !isLoginKey(key))).toHaveLength(2)
    })

    it('carries no field a key consumer could mistake for material', async () => {
        const created = await saveLogin(
            {
                domain: 'example.com',
                username: 'ada@example.com',
                password: 'secret',
                note: null,
            },
            1,
        )

        const metadata = records.get(created.id)

        expect(Object.keys(metadata ?? {}).sort()).toEqual(['kind', 'v'])
        expect(metadata).not.toHaveProperty('scheme')
        expect(metadata).not.toHaveProperty('parentKeyId')
        expect(metadata).not.toHaveProperty('origin')
        expect(metadata).not.toHaveProperty('userHandle')
    })
})

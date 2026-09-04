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

// vi.mock factories run before the rest of this module is evaluated, so
// the shared record/byte maps can only be threaded in via vi.hoisted.
const { records, sealed } = vi.hoisted(() => ({
    records: new Map<string, Record<string, unknown>>(),
    sealed: new Map<string, Uint8Array>(),
}))

vi.mock('@perawallet/wallet-core-kms', () => ({
    commitSecret: vi.fn(
        async (params: {
            id: string
            bytes: Uint8Array
            metadata?: Record<string, unknown>
        }) => {
            records.set(params.id, params.metadata ?? {})
            sealed.set(params.id, params.bytes)
        },
    ),
    withSecret: vi.fn(
        async (id: string, handler: (bytes: Uint8Array) => unknown) => {
            const bytes = sealed.get(id)
            return bytes === undefined ? null : handler(bytes)
        },
    ),
    removeSecret: vi.fn(async (id: string) => {
        records.delete(id)
        sealed.delete(id)
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

import { readLogin, saveLogin } from '../loginStore'

describe('login records coexisting with key material', () => {
    beforeEach(() => {
        records.clear()
        sealed.clear()
    })

    it('keeps the service and account identifiers out of plaintext metadata', async () => {
        const domain = 'distinctive-bank.example'
        const username = 'ada.lovelace+distinctive@example.com'

        const created = await saveLogin(
            {
                domain,
                username,
                password: 'secret',
                note: null,
            },
            1,
        )

        const metadata = records.get(created.id)
        const metadataJson = JSON.stringify(metadata ?? {})

        // The record set is walked in the clear by key counting, hydration
        // and reconciliation, so any string here is effectively an index of
        // which services the user holds logins for.
        expect(metadataJson).not.toContain(domain)
        expect(metadataJson).not.toContain(username)

        const roundTripped = await readLogin(created.id)
        expect(roundTripped?.domain).toBe(domain)
        expect(roundTripped?.username).toBe(username)
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

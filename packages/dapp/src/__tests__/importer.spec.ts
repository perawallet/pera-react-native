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

import { describe, expect, it } from 'vitest'
import { memoryStore } from '@perawallet/wallet-core-connections/testing'
import {
    importLegacyDappPermissions,
    LEGACY_DAPP_PERMISSIONS_KEY,
} from '../importer'
import { DAPP_KIND } from '../protocol'

const makeArea = (seed?: unknown) => {
    const backing: Record<string, unknown> =
        seed === undefined ? {} : { [LEGACY_DAPP_PERMISSIONS_KEY]: seed }
    return {
        backing,
        get: async (key: string) =>
            key in backing ? { [key]: backing[key] } : {},
        remove: async (key: string) => {
            delete backing[key]
        },
    }
}

const GRANTS = {
    'https://a.example': {
        origin: 'https://a.example',
        addresses: ['AAAA'],
        name: 'A',
        iconUrl: 'https://a.example/i.png',
        grantedAt: 1_700_000_000_000,
    },
    'https://b.example': {
        origin: 'https://b.example',
        addresses: ['BBBB', 'CCCC'],
        grantedAt: 1_700_000_001_000,
    },
}

describe('importLegacyDappPermissions', () => {
    it('upserts one dapp connection per origin and deletes the legacy key once every record reads back', async () => {
        const area = makeArea(GRANTS)
        const store = memoryStore()

        const result = await importLegacyDappPermissions({ area, store })

        expect(result).toEqual({ imported: 2 })
        const a = await store.get('https://a.example')
        expect(a).toMatchObject({
            id: 'https://a.example',
            kind: DAPP_KIND,
            name: 'A',
            peer: {
                name: 'A',
                url: 'https://a.example',
                icons: ['https://a.example/i.png'],
            },
            accounts: ['AAAA'],
            status: 'active',
            createdAt: 1_700_000_000_000,
            lastActiveAt: 1_700_000_000_000,
        })
        expect(a?.origin).toBeUndefined()
        expect((await store.get('https://b.example'))?.peer).toEqual({
            name: 'b.example',
            url: 'https://b.example',
        })
        expect(area.backing[LEGACY_DAPP_PERMISSIONS_KEY]).toBeUndefined()
    })

    it('is a no-op with nothing to import', async () => {
        const store = memoryStore()

        expect(
            await importLegacyDappPermissions({ area: makeArea(), store }),
        ).toEqual({ imported: 0 })
    })

    it('does not overwrite a connection the registry already holds, and skips malformed grants', async () => {
        const area = makeArea({ ...GRANTS, junk: { origin: 42 } })
        const store = memoryStore([
            {
                id: 'https://a.example',
                kind: DAPP_KIND,
                name: 'Kept',
                peer: { name: 'Kept', url: 'https://a.example' },
                accounts: ['ZZZZ'],
                status: 'active',
                createdAt: 9,
                lastActiveAt: 9,
            },
        ])

        const result = await importLegacyDappPermissions({ area, store })

        expect(result).toEqual({ imported: 1 })
        expect((await store.get('https://a.example'))?.accounts).toEqual([
            'ZZZZ',
        ])
        expect(await store.get('https://b.example')).toBeDefined()
        expect(area.backing[LEGACY_DAPP_PERMISSIONS_KEY]).toBeUndefined()
    })

    it('keeps the legacy key when a record did not persist, so the next launch retries', async () => {
        const area = makeArea(GRANTS)
        const base = memoryStore()
        const flaky = { ...base, upsert: async () => {} }

        const result = await importLegacyDappPermissions({
            area,
            store: flaky,
        })

        expect(result).toEqual({ imported: 2 })
        expect(area.backing[LEGACY_DAPP_PERMISSIONS_KEY]).toBeDefined()
    })
})

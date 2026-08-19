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

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { setupServer } from 'msw/node'
import { buildRestoreHandlers } from '../msw-handlers'
import { decryptItemPayload } from '../../crypto/itemPayload'

const BACKUP_ID = 'did:pera:test-backup-id'
const ENCRYPTION_KEY = new Uint8Array(32).fill(0x42) // 32-byte key for AES-256

const FIXTURE_ITEMS = [
    { key: 'AAAA', plaintext: '{"address":"AAAA","type":"standard"}' },
    { key: 'BBBB', plaintext: '{"address":"BBBB","type":"ledger"}', ver: 3 },
]

const BASE = 'http://backup.test'

const handlers = buildRestoreHandlers({
    backupId: BACKUP_ID,
    encryptionKey: ENCRYPTION_KEY,
    items: FIXTURE_ITEMS,
})

const server = setupServer(...handlers)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterAll(() => server.close())

describe('buildRestoreHandlers', () => {
    it('returns 3 handlers', () => {
        expect(handlers).toHaveLength(3)
    })

    it('GET manifest returns all fixture items with ACTIVE status', async () => {
        const res = await fetch(
            `${BASE}/api/v3/backup/${encodeURIComponent(BACKUP_ID)}/manifest`,
        )
        expect(res.ok).toBe(true)

        const body = await res.json()
        expect(body.backup_id).toBe(BACKUP_ID)
        expect(body.backup_global_hash).toBe('sha256:global')
        expect(body.last_seq).toBe(FIXTURE_ITEMS.length)
        expect(Object.keys(body.items)).toHaveLength(FIXTURE_ITEMS.length)

        for (const item of FIXTURE_ITEMS) {
            expect(body.items[item.key]).toBeDefined()
            expect(body.items[item.key].status).toBe('ACTIVE')
            expect(body.items[item.key].type).toBe('ACCOUNT')
        }
    })

    it('GET delta with from_seq=0 returns all entries', async () => {
        const res = await fetch(
            `${BASE}/api/v3/backup/${encodeURIComponent(BACKUP_ID)}/delta?from_seq=0`,
        )
        expect(res.ok).toBe(true)

        const body = await res.json()
        expect(body.entries).toHaveLength(FIXTURE_ITEMS.length)
        expect(body.entries[0].op).toBe('UPSERT')
        expect(body.entries[0].status).toBe('ACTIVE')
    })

    it('GET delta with from_seq=1 returns only entries after seq 1', async () => {
        const res = await fetch(
            `${BASE}/api/v3/backup/${encodeURIComponent(BACKUP_ID)}/delta?from_seq=1`,
        )
        expect(res.ok).toBe(true)

        const body = await res.json()
        // Only the second item (seq=2) is after from_seq=1
        expect(body.entries).toHaveLength(1)
        expect(body.entries[0].key).toBe(FIXTURE_ITEMS[1].key)
    })

    it('POST items/read returns FOUND with payload that round-trips via decrypt', async () => {
        const res = await fetch(
            `${BASE}/api/v3/backup/${encodeURIComponent(BACKUP_ID)}/items/read`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ keys: [FIXTURE_ITEMS[0].key] }),
            },
        )
        expect(res.ok).toBe(true)

        const body = await res.json()
        expect(body.items).toHaveLength(1)

        const entry = body.items[0]
        expect(entry.status).toBe('FOUND')
        expect(entry.key).toBe(FIXTURE_ITEMS[0].key)
        expect(typeof entry.payload).toBe('string')

        const decrypted = decryptItemPayload(entry.payload, {
            encryptionKey: ENCRYPTION_KEY,
            backupId: BACKUP_ID,
            key: FIXTURE_ITEMS[0].key,
        })
        expect(decrypted).toBe(FIXTURE_ITEMS[0].plaintext)
    })

    it('POST items/read returns NOT_FOUND for unknown keys', async () => {
        const res = await fetch(
            `${BASE}/api/v3/backup/${encodeURIComponent(BACKUP_ID)}/items/read`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ keys: ['UNKNOWN_KEY'] }),
            },
        )
        expect(res.ok).toBe(true)

        const body = await res.json()
        expect(body.items[0].status).toBe('NOT_FOUND')
        expect(body.items[0].key).toBe('UNKNOWN_KEY')
    })

    it('POST items/read handles mixed FOUND and NOT_FOUND keys', async () => {
        const res = await fetch(
            `${BASE}/api/v3/backup/${encodeURIComponent(BACKUP_ID)}/items/read`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    keys: [FIXTURE_ITEMS[1].key, 'MISSING'],
                }),
            },
        )
        expect(res.ok).toBe(true)

        const body = await res.json()
        expect(body.items).toHaveLength(2)

        const found = body.items.find(
            (i: { key: string }) => i.key === FIXTURE_ITEMS[1].key,
        )
        const notFound = body.items.find(
            (i: { key: string }) => i.key === 'MISSING',
        )

        expect(found.status).toBe('FOUND')
        expect(notFound.status).toBe('NOT_FOUND')

        const decrypted = decryptItemPayload(found.payload, {
            encryptionKey: ENCRYPTION_KEY,
            backupId: BACKUP_ID,
            key: FIXTURE_ITEMS[1].key,
        })
        expect(decrypted).toBe(FIXTURE_ITEMS[1].plaintext)
    })

    it('POST items/read respects custom ver from fixture', async () => {
        const res = await fetch(
            `${BASE}/api/v3/backup/${encodeURIComponent(BACKUP_ID)}/items/read`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ keys: [FIXTURE_ITEMS[1].key] }),
            },
        )
        const body = await res.json()
        // FIXTURE_ITEMS[1] has ver: 3
        expect(body.items[0].ver).toBe(3)
    })
})

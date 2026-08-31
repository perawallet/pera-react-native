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

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { setupServer } from 'msw/node'
import type { HttpHandler } from 'msw'
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

import { buildSyncHandlers } from '../msw-handlers'

describe('buildSyncHandlers', () => {
    const SYNC_BACKUP_ID = 'did:pera:sync-test'
    const SYNC_BASE = 'http://backup.test'

    const handle = buildSyncHandlers({ backupId: SYNC_BACKUP_ID })
    const syncServer = setupServer(...handle.handlers)

    beforeAll(() => syncServer.listen({ onUnhandledRequest: 'error' }))
    afterAll(() => syncServer.close())

    const upsert = (key: string) =>
        fetch(
            `${SYNC_BASE}/api/v3/backup/${encodeURIComponent(SYNC_BACKUP_ID)}/items/upsert`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    device_id: 'dev',
                    items: [
                        {
                            key,
                            type: 'ACCOUNT',
                            expected_ver: 0,
                            status: 'ACTIVE',
                            payload: 'enc-payload',
                        },
                    ],
                }),
            },
        ).then(r => r.json())

    it('records an upsert and reflects it in the manifest', async () => {
        const res = await upsert('accounts/AAAA')
        expect(res.results[0]).toMatchObject({
            key: 'accounts/AAAA',
            result: 'OK',
            new_ver: 1,
            seq: 1,
        })

        const manifest = await fetch(
            `${SYNC_BASE}/api/v3/backup/${encodeURIComponent(SYNC_BACKUP_ID)}/manifest`,
        ).then(r => r.json())
        expect(manifest.items['accounts/AAAA']).toMatchObject({
            ver: 1,
            status: 'ACTIVE',
        })
    })

    it('GET delta with from_seq=0 returns the upserted entry; from_seq=1 returns nothing', async () => {
        const deltaAll = await fetch(
            `${SYNC_BASE}/api/v3/backup/${encodeURIComponent(SYNC_BACKUP_ID)}/delta?from_seq=0`,
        ).then(r => r.json())
        expect(deltaAll.entries.length).toBeGreaterThanOrEqual(1)
        const entry = deltaAll.entries.find(
            (e: { key: string }) => e.key === 'accounts/AAAA',
        )
        expect(entry).toBeDefined()
        expect(entry.op).toBe('UPSERT')

        // seq of the upserted item was 1; from_seq=1 returns nothing for seq <= 1
        const deltaAfter = await fetch(
            `${SYNC_BASE}/api/v3/backup/${encodeURIComponent(SYNC_BACKUP_ID)}/delta?from_seq=1`,
        ).then(r => r.json())
        const afterEntry = deltaAfter.entries.find(
            (e: { key: string }) => e.key === 'accounts/AAAA',
        )
        expect(afterEntry).toBeUndefined()
    })

    it('DELETE /:prefix/:addr removes the item from the manifest', async () => {
        // First ensure accounts/CCCC exists
        await upsert('accounts/CCCC')

        const delRes = await fetch(
            `${SYNC_BASE}/api/v3/backup/${encodeURIComponent(SYNC_BACKUP_ID)}/accounts/CCCC`,
            { method: 'DELETE' },
        ).then(r => r.json())
        expect(typeof delRes.seq).toBe('number')

        const manifest = await fetch(
            `${SYNC_BASE}/api/v3/backup/${encodeURIComponent(SYNC_BACKUP_ID)}/manifest`,
        ).then(r => r.json())
        expect(manifest.items['accounts/CCCC']).toBeUndefined()
    })

    it('forceConflict causes the next upsert for that key to return VERSION_CONFLICT', async () => {
        handle.forceConflict('accounts/BBBB')

        const res = await upsert('accounts/BBBB')
        expect(res.results[0]).toMatchObject({
            key: 'accounts/BBBB',
            result: 'VERSION_CONFLICT',
        })
        expect(typeof res.results[0].current_ver).toBe('number')
        expect(typeof res.results[0].current_hash).toBe('string')
    })
})

import { buildRegisterHandler } from '../msw-handlers'

describe('buildRegisterHandler', () => {
    const REGISTER_URL = `${BASE}/api/v3/backup/register`
    const BODY = { backup_id: BACKUP_ID, device_id: 'device-1' }

    const register = () =>
        fetch(REGISTER_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(BODY),
        })

    const serve = (handler: HttpHandler) => {
        const registerServer = setupServer(handler)
        registerServer.listen({ onUnhandledRequest: 'error' })
        return registerServer
    }

    it('hands the parsed body to onRegister and answers 200 ok', async () => {
        const onRegister = vi.fn()
        const registerServer = serve(buildRegisterHandler({ onRegister }))

        const res = await register()

        expect(res.status).toBe(200)
        expect(await res.json()).toEqual({ ok: true })
        expect(onRegister).toHaveBeenCalledWith(BODY)
        registerServer.close()
    })

    it('answers the requested error status with an empty body, having still reported the attempt', async () => {
        const onRegister = vi.fn()
        const registerServer = serve(
            buildRegisterHandler({ onRegister, status: 500 }),
        )

        const res = await register()

        expect(res.status).toBe(500)
        expect(await res.text()).toBe('')
        expect(onRegister).toHaveBeenCalledTimes(1)
        registerServer.close()
    })

    it('passes a non-error status through rather than forcing 200', async () => {
        const registerServer = serve(buildRegisterHandler({ status: 202 }))

        const res = await register()

        expect(res.status).toBe(202)
        expect(await res.json()).toEqual({ ok: true })
        registerServer.close()
    })

    it('needs no arguments', async () => {
        const registerServer = serve(buildRegisterHandler())

        const res = await register()

        expect(res.status).toBe(200)
        registerServer.close()
    })
})

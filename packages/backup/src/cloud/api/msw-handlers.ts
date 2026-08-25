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

import { http, HttpResponse, type HttpHandler } from 'msw'
import { encryptItemPayload } from '../crypto/itemPayload'
import type { BackupId, BackupItemKey } from '../models'

export type RestoreFixtureItem = {
    /** The backup item key (e.g. an account address). */
    key: BackupItemKey
    /** Raw UTF-8 plaintext — will be encrypted in the handler response. */
    plaintext: string
    /** Item version; defaults to `1`. */
    ver?: number
    /**
     * Item hash; defaults to `'sha256:fixture'`.
     */
    hash?: string
}

export type BuildRestoreHandlersParams = {
    backupId: BackupId
    encryptionKey: Uint8Array
    items: RestoreFixtureItem[]
}

export const buildRestoreHandlers = ({
    backupId,
    encryptionKey,
    items,
}: BuildRestoreHandlersParams): HttpHandler[] => {
    const resolvedItems = items.map((item, index) => ({
        key: item.key,
        plaintext: item.plaintext,
        ver: item.ver ?? 1,
        hash: item.hash ?? 'sha256:fixture',
        seq: index + 1,
    }))

    const encodedBackupId = encodeURIComponent(backupId)

    const manifestHandler = http.get(
        `*/api/v3/backup/${encodedBackupId}/manifest`,
        () => {
            const manifestItems: Record<
                string,
                {
                    key: string
                    type: 'ACCOUNT'
                    ver: number
                    status: 'ACTIVE'
                    hash: string
                    last_seq: number
                }
            > = {}

            for (const item of resolvedItems) {
                manifestItems[item.key] = {
                    key: item.key,
                    type: 'ACCOUNT',
                    ver: item.ver,
                    status: 'ACTIVE',
                    hash: item.hash,
                    last_seq: item.seq,
                }
            }

            return HttpResponse.json({
                backup_id: backupId,
                backup_global_hash: 'sha256:global',
                global_version: resolvedItems.length,
                last_seq: resolvedItems.length,
                generated_at: new Date().toISOString(),
                items: manifestItems,
            })
        },
    )

    const deltaHandler = http.get(
        `*/api/v3/backup/${encodedBackupId}/delta`,
        ({ request }) => {
            const url = new URL(request.url)
            const fromSeq = Number(url.searchParams.get('from_seq') ?? '0')

            const entries = resolvedItems
                .filter(item => item.seq > fromSeq)
                .map(item => ({
                    seq: item.seq,
                    key: item.key,
                    type: 'ACCOUNT' as const,
                    ver: item.ver,
                    status: 'ACTIVE' as const,
                    op: 'UPSERT' as const,
                    hash: item.hash,
                }))

            return HttpResponse.json({ entries })
        },
    )

    const itemsReadHandler = http.post(
        `*/api/v3/backup/${encodedBackupId}/items/read`,
        async ({ request }) => {
            const body = (await request.json()) as { keys: string[] }
            const requestedKeys: BackupItemKey[] = Array.isArray(body?.keys)
                ? body.keys
                : []

            const itemByKey = new Map(
                resolvedItems.map(item => [item.key, item]),
            )

            const responseItems = requestedKeys.map(key => {
                const item = itemByKey.get(key)
                if (!item) {
                    return { key, status: 'NOT_FOUND' as const }
                }

                const payload = encryptItemPayload(item.plaintext, {
                    encryptionKey,
                    backupId,
                    key,
                })

                return {
                    key,
                    status: 'FOUND' as const,
                    ver: item.ver,
                    hash: item.hash,
                    payload,
                }
            })

            return HttpResponse.json({ items: responseItems })
        },
    )

    return [manifestHandler, deltaHandler, itemsReadHandler]
}

// ---------------------------------------------------------------------------
// buildSyncHandlers — stateful MSW factory for sync engine tests
// ---------------------------------------------------------------------------

type SyncStoreItem = {
    key: string
    payload: string
    ver: number
    hash: string
    seq: number
    status: 'ACTIVE' | 'IGNORED'
}

export type BuildSyncHandlersParams = {
    backupId: BackupId
    /** Optional seed items (already-encrypted payloads). */
    initial?: { key: string; payload: string }[]
}

export type SyncHandlerHandle = {
    handlers: HttpHandler[]
    getItem: (key: string) => SyncStoreItem | undefined
    /** Force the next upsert of `key` to report VERSION_CONFLICT. */
    forceConflict: (key: string) => void
}

export const buildSyncHandlers = ({
    backupId,
    initial = [],
}: BuildSyncHandlersParams): SyncHandlerHandle => {
    const encodedBackupId = encodeURIComponent(backupId)
    let seq = 0
    let globalVersion = 0
    const conflicts = new Set<string>()
    const items = new Map<string, SyncStoreItem>()

    for (const it of initial) {
        seq += 1
        globalVersion += 1
        items.set(it.key, {
            key: it.key,
            payload: it.payload,
            ver: 1,
            hash: `sha256:${seq}`,
            seq,
            status: 'ACTIVE',
        })
    }

    const globalHash = () => `sha256:global:${globalVersion}`

    const manifest = http.get(
        `*/api/v3/backup/${encodedBackupId}/manifest`,
        () => {
            const out: Record<string, unknown> = {}
            for (const it of items.values()) {
                out[it.key] = {
                    key: it.key,
                    type: 'ACCOUNT',
                    ver: it.ver,
                    status: it.status,
                    hash: it.hash,
                    last_seq: it.seq,
                }
            }
            return HttpResponse.json({
                backup_id: backupId,
                backup_global_hash: globalHash(),
                global_version: globalVersion,
                last_seq: seq,
                generated_at: new Date().toISOString(),
                items: out,
            })
        },
    )

    const delta = http.get(
        `*/api/v3/backup/${encodedBackupId}/delta`,
        ({ request }) => {
            const fromSeq = Number(
                new URL(request.url).searchParams.get('from_seq') ?? '0',
            )
            const entries = [...items.values()]
                .filter(i => i.seq > fromSeq)
                .map(i => ({
                    seq: i.seq,
                    key: i.key,
                    type: 'ACCOUNT' as const,
                    ver: i.ver,
                    status: i.status,
                    op: 'UPSERT' as const,
                    hash: i.hash,
                }))
            return HttpResponse.json({ entries })
        },
    )

    const read = http.post(
        `*/api/v3/backup/${encodedBackupId}/items/read`,
        async ({ request }) => {
            const body = (await request.json()) as { keys: string[] }
            const responseItems = (body.keys ?? []).map(key => {
                const it = items.get(key)
                if (it) {
                    return {
                        key,
                        status: 'FOUND' as const,
                        ver: it.ver,
                        hash: it.hash,
                        payload: it.payload,
                    }
                }
                return { key, status: 'NOT_FOUND' as const }
            })
            return HttpResponse.json({ items: responseItems })
        },
    )

    const batchUpsert = http.post(
        `*/api/v3/backup/${encodedBackupId}/items/upsert`,
        async ({ request }) => {
            const body = (await request.json()) as {
                items: {
                    key: string
                    expected_ver: number
                    payload: string
                    status: 'ACTIVE' | 'IGNORED'
                }[]
            }
            const results = body.items.map(entry => {
                if (conflicts.has(entry.key)) {
                    conflicts.delete(entry.key)
                    const cur = items.get(entry.key)
                    return {
                        key: entry.key,
                        result: 'VERSION_CONFLICT' as const,
                        current_ver: cur?.ver ?? entry.expected_ver + 1,
                        current_hash: cur?.hash ?? 'sha256:conflict',
                    }
                }
                seq += 1
                globalVersion += 1
                const prev = items.get(entry.key)
                const newVer = (prev?.ver ?? 0) + 1
                items.set(entry.key, {
                    key: entry.key,
                    payload: entry.payload,
                    ver: newVer,
                    hash: `sha256:${seq}`,
                    seq,
                    status: entry.status,
                })
                return {
                    key: entry.key,
                    result: 'OK' as const,
                    new_ver: newVer,
                    seq,
                }
            })
            return HttpResponse.json({ results })
        },
    )

    const put = http.put(
        `*/api/v3/backup/${encodedBackupId}/:prefix/:addr`,
        async ({ params, request }) => {
            const key = `${params.prefix}/${params.addr}`
            const body = (await request.json()) as {
                payload: string
                status: 'ACTIVE' | 'IGNORED'
            }
            seq += 1
            globalVersion += 1
            const newVer = (items.get(key)?.ver ?? 0) + 1
            items.set(key, {
                key,
                payload: body.payload,
                ver: newVer,
                hash: `sha256:${seq}`,
                seq,
                status: body.status,
            })
            return HttpResponse.json({ new_ver: newVer, seq })
        },
    )

    const del = http.delete(
        `*/api/v3/backup/${encodedBackupId}/:prefix/:addr`,
        ({ params }) => {
            const key = `${params.prefix}/${params.addr}`
            items.delete(key)
            seq += 1
            globalVersion += 1
            return HttpResponse.json({ seq })
        },
    )

    return {
        handlers: [manifest, delta, read, batchUpsert, put, del],
        getItem: key => items.get(key),
        forceConflict: key => conflicts.add(key),
    }
}

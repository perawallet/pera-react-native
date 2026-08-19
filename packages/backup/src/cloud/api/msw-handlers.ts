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

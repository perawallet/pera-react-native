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

import { z } from 'zod'

export const BackupWebSocketMessageType = {
    ITEMS_UPDATED: 'ITEMS_UPDATED',
    BACKUP_DELETED: 'BACKUP_DELETED',
} as const
export type BackupWebSocketMessageType =
    (typeof BackupWebSocketMessageType)[keyof typeof BackupWebSocketMessageType]

/** Steers the delta pull that follows; `.default(0)` keeps the old tolerance
 *  for an omitted field while rejecting a wrong-typed or negative one. */
const seq = z.number().int().nonnegative().default(0)

export const itemsUpdatedMessageSchema = z.object({
    type: z.literal(BackupWebSocketMessageType.ITEMS_UPDATED),
    from_seq: seq,
    to_seq: seq,
})

export const backupDeletedMessageSchema = z.object({
    type: z.literal(BackupWebSocketMessageType.BACKUP_DELETED),
})

export const backupWebSocketMessageSchema = z.discriminatedUnion('type', [
    itemsUpdatedMessageSchema,
    backupDeletedMessageSchema,
])

export type ItemsUpdatedMessage = z.infer<typeof itemsUpdatedMessageSchema>
export type BackupDeletedMessage = z.infer<typeof backupDeletedMessageSchema>
export type BackupWebSocketMessage = z.infer<
    typeof backupWebSocketMessageSchema
>

export const BackupWebSocketMessageReject = {
    Unparseable: 'unparseable',
    UnknownType: 'unknownType',
    Malformed: 'malformed',
} as const
export type BackupWebSocketMessageReject =
    (typeof BackupWebSocketMessageReject)[keyof typeof BackupWebSocketMessageReject]

export type ParsedBackupWebSocketMessage =
    | { ok: true; message: BackupWebSocketMessage }
    | { ok: false; reject: BackupWebSocketMessageReject; type?: string }

const knownTypes = new Set<string>(Object.values(BackupWebSocketMessageType))

/**
 * Never throws — the caller decides how loudly to complain. An unknown `type`
 * is reported separately from a malformed one: the server may add message kinds
 * an older client should ignore, whereas a recognised kind that fails
 * validation is a genuine contract break.
 */
export const parseBackupWebSocketMessage = (
    data: unknown,
): ParsedBackupWebSocketMessage => {
    let json: unknown
    try {
        json = JSON.parse(typeof data === 'string' ? data : String(data))
    } catch {
        return { ok: false, reject: BackupWebSocketMessageReject.Unparseable }
    }

    const type =
        typeof json === 'object' && json !== null
            ? (json as { type?: unknown }).type
            : undefined
    const typeName = typeof type === 'string' ? type : undefined

    if (typeName === undefined || !knownTypes.has(typeName)) {
        return {
            ok: false,
            reject: BackupWebSocketMessageReject.UnknownType,
            type: typeName,
        }
    }

    const result = backupWebSocketMessageSchema.safeParse(json)
    if (!result.success) {
        return {
            ok: false,
            reject: BackupWebSocketMessageReject.Malformed,
            type: typeName,
        }
    }
    return { ok: true, message: result.data }
}

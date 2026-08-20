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
import {
    BackupItemStatus,
    BackupItemType,
    DeltaOperation,
    type EncryptedPayload,
} from '../models'

// Requests are plain types, responses are schemas: we construct request bodies
// ourselves, so there is no boundary to guard. Responses arrive as unvalidated
// JSON and go through `parseBackupResponse` before any field is read.

const nonNegativeInt = z.number().int().nonnegative()

export type RegisterBackupRequest = {
    backup_id: string
    public_key: string
    device_id: string
    nonce: string
    wallet_signature: string
}

export type ReadItemsRequest = {
    keys: string[]
}

export type UpsertItemRequest = {
    expected_ver: number
    status: BackupItemStatus
    device_id: string
    type: BackupItemType
    payload: EncryptedPayload
}

export type UpsertItemEntry = {
    key: string
    type: BackupItemType
    expected_ver: number
    status: BackupItemStatus
    payload: EncryptedPayload
}

export type BatchUpsertRequest = {
    device_id: string
    items: UpsertItemEntry[]
}

export const registerBackupResponseSchema = z.object({
    ok: z.boolean(),
})
export type RegisterBackupResponse = z.infer<
    typeof registerBackupResponseSchema
>

export const manifestItemResponseSchema = z.object({
    type: z.enum(BackupItemType),
    ver: nonNegativeInt,
    status: z.enum(BackupItemStatus),
    hash: z.string(),
    last_seq: nonNegativeInt,
})
export type ManifestItemResponse = z.infer<typeof manifestItemResponseSchema>

export const manifestResponseSchema = z.object({
    backup_id: z.string(),
    backup_global_hash: z.string(),
    global_version: nonNegativeInt,
    last_seq: nonNegativeInt,
    generated_at: z.string(),
    items: z.record(z.string(), manifestItemResponseSchema).default({}),
})
export type ManifestResponse = z.infer<typeof manifestResponseSchema>

export const deltaEntryResponseSchema = z.object({
    seq: nonNegativeInt,
    key: z.string(),
    type: z.enum(BackupItemType),
    ver: nonNegativeInt,
    status: z.enum(BackupItemStatus),
    op: z.enum(DeltaOperation),
    // Absent on some DELETE entries; normalized so downstream sees one shape.
    hash: z
        .string()
        .nullish()
        .transform(value => value ?? null),
})
export type DeltaEntryResponse = z.infer<typeof deltaEntryResponseSchema>

export const deltaResponseSchema = z.object({
    entries: z.array(deltaEntryResponseSchema).default([]),
})
export type DeltaResponse = z.infer<typeof deltaResponseSchema>

export const ItemReadStatus = {
    FOUND: 'FOUND',
    NOT_FOUND: 'NOT_FOUND',
    DELETED: 'DELETED',
} as const
export type ItemReadStatus =
    (typeof ItemReadStatus)[keyof typeof ItemReadStatus]

/** Only FOUND entries carry payload/hash/ver, so the parse enforces that
 *  invariant instead of every read site re-checking it. */
export const foundReadItemEntrySchema = z.object({
    key: z.string(),
    status: z.literal(ItemReadStatus.FOUND),
    payload: z.string(),
    hash: z.string(),
    ver: nonNegativeInt,
})
export const notFoundReadItemEntrySchema = z.object({
    key: z.string(),
    status: z.literal(ItemReadStatus.NOT_FOUND),
})
export const deletedReadItemEntrySchema = z.object({
    key: z.string(),
    status: z.literal(ItemReadStatus.DELETED),
})

export const readItemEntrySchema = z.discriminatedUnion('status', [
    foundReadItemEntrySchema,
    notFoundReadItemEntrySchema,
    deletedReadItemEntrySchema,
])
export type ReadItemResponseEntry = z.infer<typeof readItemEntrySchema>
export type FoundReadItemEntry = z.infer<typeof foundReadItemEntrySchema>

/** Entries stay `unknown` on purpose: one malformed item must not cost the
 *  whole batch, so they are validated individually in `transformReadItems`. */
export const readItemsResponseSchema = z.object({
    items: z.array(z.unknown()).default([]),
})
export type ReadItemsResponse = z.infer<typeof readItemsResponseSchema>

export const upsertItemResponseSchema = z.object({
    new_ver: nonNegativeInt,
    seq: nonNegativeInt,
})
export type UpsertItemResponse = z.infer<typeof upsertItemResponseSchema>

export const UpsertResult = {
    OK: 'OK',
    VERSION_CONFLICT: 'VERSION_CONFLICT',
} as const
export type UpsertResult = (typeof UpsertResult)[keyof typeof UpsertResult]

export const batchUpsertResultEntrySchema = z.object({
    key: z.string(),
    result: z.enum(UpsertResult),
    new_ver: nonNegativeInt.optional(),
    current_ver: nonNegativeInt.optional(),
    current_hash: z.string().optional(),
    seq: nonNegativeInt.optional(),
})
export type BatchUpsertResultEntry = z.infer<
    typeof batchUpsertResultEntrySchema
>

export const batchUpsertResponseSchema = z.object({
    results: z.array(batchUpsertResultEntrySchema).default([]),
})
export type BatchUpsertResponse = z.infer<typeof batchUpsertResponseSchema>

export const deleteItemResponseSchema = z.object({
    seq: nonNegativeInt,
})
export type DeleteItemResponse = z.infer<typeof deleteItemResponseSchema>

export const destroyBackupResponseSchema = z.object({
    backup_id: z.string(),
})
export type DestroyBackupResponse = z.infer<typeof destroyBackupResponseSchema>

export const encryptedPayloadResponseSchema = z.string()

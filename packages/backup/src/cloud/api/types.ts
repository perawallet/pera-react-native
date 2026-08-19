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

import type {
    BackupItemStatus,
    BackupItemType,
    DeltaOperation,
    EncryptedPayload,
} from '../models'

export type RegisterBackupRequest = {
    backup_id: string
    public_key: string
    device_id: string
    nonce: string
    wallet_signature: string
}

export type RegisterBackupResponse = {
    ok: boolean
}

export type ManifestItemResponse = {
    type: BackupItemType
    ver: number
    status: BackupItemStatus
    hash: string
    last_seq: number
}

export type ManifestResponse = {
    backup_id: string
    backup_global_hash: string
    global_version: number
    last_seq: number
    generated_at: string
    items: Record<string, ManifestItemResponse>
}

export type DeltaEntryResponse = {
    seq: number
    key: string
    type: BackupItemType
    ver: number
    status: BackupItemStatus
    op: DeltaOperation
    hash: string | null
}

export type DeltaResponse = {
    entries: DeltaEntryResponse[]
}

export const ItemReadStatus = {
    FOUND: 'FOUND',
    NOT_FOUND: 'NOT_FOUND',
    DELETED: 'DELETED',
} as const
export type ItemReadStatus =
    (typeof ItemReadStatus)[keyof typeof ItemReadStatus]

export type ReadItemsRequest = {
    keys: string[]
}

export type ReadItemResponseEntry = {
    key: string
    status: ItemReadStatus
    payload?: EncryptedPayload
    hash?: string
    ver?: number
}

export type ReadItemsResponse = {
    items: ReadItemResponseEntry[]
}

export type UpsertItemRequest = {
    expected_ver: number
    status: BackupItemStatus
    device_id: string
    type: BackupItemType
    payload: EncryptedPayload
}

export type UpsertItemResponse = {
    new_ver: number
    seq: number
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

export const UpsertResult = {
    OK: 'OK',
    VERSION_CONFLICT: 'VERSION_CONFLICT',
} as const
export type UpsertResult = (typeof UpsertResult)[keyof typeof UpsertResult]

export type BatchUpsertResultEntry = {
    key: string
    result: UpsertResult
    new_ver?: number
    current_ver?: number
    current_hash?: string
    seq?: number
}

export type BatchUpsertResponse = {
    results: BatchUpsertResultEntry[]
}

export type DeleteItemResponse = {
    seq: number
}

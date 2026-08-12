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

export type BackupId = string

export type DeviceId = string

export type BackupItemKey = string

export type ItemHash = string

export type BackupGlobalHash = string

export const BackupItemType = {
    ACCOUNT: 'ACCOUNT',
    CONTACT: 'CONTACT',
    PASSKEY: 'PASSKEY',
} as const
export type BackupItemType =
    (typeof BackupItemType)[keyof typeof BackupItemType]

export const BackupItemStatus = {
    ACTIVE: 'ACTIVE',
    IGNORED: 'IGNORED',
} as const
export type BackupItemStatus =
    (typeof BackupItemStatus)[keyof typeof BackupItemStatus]

export const DeltaOperation = {
    UPSERT: 'UPSERT',
    DELETE: 'DELETE',
} as const
export type DeltaOperation =
    (typeof DeltaOperation)[keyof typeof DeltaOperation]

export type EncryptedPayload = string

export type ManifestItem = {
    type: BackupItemType
    ver: number
    status: BackupItemStatus
    hash: ItemHash
    lastSeq: number
}

export type Manifest = {
    backupId: BackupId
    backupGlobalHash: BackupGlobalHash
    globalVersion: number
    lastSeq: number
    generatedAt: string
    items: Record<BackupItemKey, ManifestItem>
}

export type DeltaEntry = {
    seq: number
    key: BackupItemKey
    type: BackupItemType
    ver: number
    status: BackupItemStatus
    op: DeltaOperation
    hash: ItemHash | null
}

export type FetchedItem = {
    key: BackupItemKey
    payload: EncryptedPayload
    hash: ItemHash
    ver: number
}

export type Argon2idConfig = {
    timeCost: number
    memoryCost: number
    parallelism: number
    outputLength: number
}

export type RestoreHelperPayload = {
    version: number
    salt: string
    argon2idConfig: Argon2idConfig
}

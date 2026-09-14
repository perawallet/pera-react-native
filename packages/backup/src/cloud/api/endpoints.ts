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

import {
    isPeraNetworkError,
    queryClient,
    type Network,
} from '@perawallet/wallet-core-shared'
import type {
    BackupId,
    BackupItemKey,
    DeltaEntry,
    DeviceId,
    EncryptedPayload,
    FetchedItem,
    Manifest,
} from '../models'
import {
    transformDeltaEntries,
    transformManifest,
    transformReadItems,
} from './transformers'
import type {
    BatchUpsertRequest,
    BatchUpsertResponse,
    DeleteItemResponse,
    DestroyBackupResponse,
    RegisterBackupRequest,
    RegisterBackupResponse,
    UpsertItemRequest,
    UpsertItemResponse,
} from './types'
import {
    batchUpsertResponseSchema,
    deleteItemResponseSchema,
    deltaResponseSchema,
    destroyBackupResponseSchema,
    encryptedPayloadResponseSchema,
    manifestResponseSchema,
    readItemsResponseSchema,
    registerBackupResponseSchema,
    upsertItemResponseSchema,
} from './types'
import { parseBackupResponse } from './responseParsers'
import { signedBackupRequest } from './signedRequest'
import { API_PREFIX } from './constants'

export const registerBackup = async (
    network: Network,
    request: RegisterBackupRequest,
): Promise<RegisterBackupResponse> => {
    const response = await queryClient<unknown, RegisterBackupRequest>({
        backend: 'backup',
        network,
        method: 'POST',
        url: `${API_PREFIX}/backup/register`,
        data: request,
    })
    return parseBackupResponse(
        registerBackupResponseSchema,
        response.data,
        'register',
    )
}

export const fetchManifest = async (
    network: Network,
    backupId: BackupId,
    deviceId: DeviceId,
): Promise<Manifest> => {
    const data = await signedBackupRequest<unknown>({
        network,
        method: 'GET',
        backupId,
        pathSuffix: '/manifest',
        deviceId,
    })
    return transformManifest(
        parseBackupResponse(manifestResponseSchema, data, 'manifest'),
    )
}

const HTTP_GONE = 410

/** Changelog retention has pruned past the requested `from_seq`, so the deltas
 *  that would describe the gap no longer exist. Retrying cannot help — not even
 *  at `from_seq=0`, which is itself rejected once anything has been pruned — so
 *  callers have to rebuild from the manifest instead. */
export class FromSeqTooOldError extends Error {
    constructor(readonly fromSeq: number) {
        super(`Backup changelog no longer reaches back to seq ${fromSeq}`)
        this.name = 'FromSeqTooOldError'
    }
}

export const isFromSeqTooOldError = (
    error: unknown,
): error is FromSeqTooOldError => error instanceof FromSeqTooOldError

export const fetchDelta = async (
    network: Network,
    backupId: BackupId,
    deviceId: DeviceId,
    fromSeq: number,
): Promise<DeltaEntry[]> => {
    let data: unknown
    try {
        data = await signedBackupRequest<unknown>({
            network,
            method: 'GET',
            backupId,
            pathSuffix: '/delta',
            deviceId,
            params: { from_seq: fromSeq },
        })
    } catch (error) {
        // 410 is FROM_SEQ_TOO_OLD and nothing else: it is the only Gone the
        // backup API returns, and only this route returns it.
        if (isPeraNetworkError(error) && error.status === HTTP_GONE) {
            throw new FromSeqTooOldError(fromSeq)
        }
        throw error
    }
    return transformDeltaEntries(
        parseBackupResponse(deltaResponseSchema, data, 'delta').entries,
    )
}

export const fetchItem = async (
    network: Network,
    backupId: BackupId,
    deviceId: DeviceId,
    key: BackupItemKey,
): Promise<EncryptedPayload> => {
    const data = await signedBackupRequest<unknown>({
        network,
        method: 'GET',
        backupId,
        pathSuffix: `/${key}`,
        deviceId,
        responseType: 'text',
    })
    return parseBackupResponse(encryptedPayloadResponseSchema, data, 'item')
}

export const readItems = async (
    network: Network,
    backupId: BackupId,
    deviceId: DeviceId,
    keys: BackupItemKey[],
): Promise<FetchedItem[]> => {
    const data = await signedBackupRequest<unknown, { keys: string[] }>({
        network,
        method: 'POST',
        backupId,
        pathSuffix: '/items/read',
        deviceId,
        data: { keys },
    })
    return transformReadItems(
        parseBackupResponse(readItemsResponseSchema, data, 'read items').items,
    )
}

export const upsertItem = async (
    network: Network,
    backupId: BackupId,
    deviceId: DeviceId,
    key: BackupItemKey,
    request: UpsertItemRequest,
): Promise<UpsertItemResponse> => {
    const data = await signedBackupRequest<unknown, UpsertItemRequest>({
        network,
        method: 'PUT',
        backupId,
        pathSuffix: `/${key}`,
        deviceId,
        data: request,
    })
    return parseBackupResponse(upsertItemResponseSchema, data, 'upsert item')
}

export const batchUpsertItems = async (
    network: Network,
    backupId: BackupId,
    deviceId: DeviceId,
    request: BatchUpsertRequest,
): Promise<BatchUpsertResponse> => {
    const data = await signedBackupRequest<unknown, BatchUpsertRequest>({
        network,
        method: 'POST',
        backupId,
        pathSuffix: '/items/upsert',
        deviceId,
        data: request,
    })
    return parseBackupResponse(batchUpsertResponseSchema, data, 'batch upsert')
}

export const deleteItem = async (
    network: Network,
    backupId: BackupId,
    deviceId: DeviceId,
    key: BackupItemKey,
): Promise<DeleteItemResponse> => {
    const data = await signedBackupRequest<unknown>({
        network,
        method: 'DELETE',
        backupId,
        pathSuffix: `/${key}`,
        deviceId,
    })
    return parseBackupResponse(deleteItemResponseSchema, data, 'delete item')
}

/** Destroys the ENTIRE remote backup: a single signed `DELETE /backup/<id>`
 *  (empty path suffix, no body). The server wipes all items + the registration
 *  and pushes BACKUP_DELETED to other devices — do NOT enumerate-and-delete. */
export const destroyBackup = async (
    network: Network,
    backupId: BackupId,
    deviceId: DeviceId,
): Promise<DestroyBackupResponse> => {
    const data = await signedBackupRequest<unknown>({
        network,
        method: 'DELETE',
        backupId,
        pathSuffix: '',
        deviceId,
    })
    return parseBackupResponse(
        destroyBackupResponseSchema,
        data,
        'destroy backup',
    )
}

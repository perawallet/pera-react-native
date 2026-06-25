/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { queryClient, type Network } from '@perawallet/wallet-core-shared'
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
    DeltaResponse,
    ManifestResponse,
    ReadItemsResponse,
    RegisterBackupRequest,
    RegisterBackupResponse,
    UpsertItemRequest,
    UpsertItemResponse,
} from './types'
import { signedBackupRequest } from './signedRequest'
import { API_PREFIX } from './constants'

export const registerBackup = async (
    network: Network,
    request: RegisterBackupRequest,
): Promise<RegisterBackupResponse> => {
    const response = await queryClient<
        RegisterBackupResponse,
        RegisterBackupRequest
    >({
        backend: 'backup',
        network,
        method: 'POST',
        url: `${API_PREFIX}/backup/register`,
        data: request,
    })
    return response.data
}

export const fetchManifest = async (
    network: Network,
    backupId: BackupId,
    deviceId: DeviceId,
): Promise<Manifest> => {
    const data = await signedBackupRequest<ManifestResponse>({
        network,
        method: 'GET',
        backupId,
        pathSuffix: '/manifest',
        deviceId,
    })
    return transformManifest(data)
}

export const fetchDelta = async (
    network: Network,
    backupId: BackupId,
    deviceId: DeviceId,
    fromSeq: number,
): Promise<DeltaEntry[]> => {
    const data = await signedBackupRequest<DeltaResponse>({
        network,
        method: 'GET',
        backupId,
        pathSuffix: '/delta',
        deviceId,
        params: { from_seq: fromSeq },
    })
    return transformDeltaEntries(data.entries ?? [])
}

export const fetchItem = async (
    network: Network,
    backupId: BackupId,
    deviceId: DeviceId,
    key: BackupItemKey,
): Promise<EncryptedPayload> =>
    signedBackupRequest<EncryptedPayload>({
        network,
        method: 'GET',
        backupId,
        pathSuffix: `/${key}`,
        deviceId,
        responseType: 'text',
    })

export const readItems = async (
    network: Network,
    backupId: BackupId,
    deviceId: DeviceId,
    keys: BackupItemKey[],
): Promise<FetchedItem[]> => {
    const data = await signedBackupRequest<
        ReadItemsResponse,
        { keys: string[] }
    >({
        network,
        method: 'POST',
        backupId,
        pathSuffix: '/items/read',
        deviceId,
        data: { keys },
    })
    return transformReadItems(data.items ?? [])
}

export const upsertItem = async (
    network: Network,
    backupId: BackupId,
    deviceId: DeviceId,
    key: BackupItemKey,
    request: UpsertItemRequest,
): Promise<UpsertItemResponse> =>
    signedBackupRequest<UpsertItemResponse, UpsertItemRequest>({
        network,
        method: 'PUT',
        backupId,
        pathSuffix: `/${key}`,
        deviceId,
        data: request,
    })

export const batchUpsertItems = async (
    network: Network,
    backupId: BackupId,
    deviceId: DeviceId,
    request: BatchUpsertRequest,
): Promise<BatchUpsertResponse> =>
    signedBackupRequest<BatchUpsertResponse, BatchUpsertRequest>({
        network,
        method: 'POST',
        backupId,
        pathSuffix: '/items/upsert',
        deviceId,
        data: request,
    })

export const deleteItem = async (
    network: Network,
    backupId: BackupId,
    deviceId: DeviceId,
    key: BackupItemKey,
): Promise<DeleteItemResponse> =>
    signedBackupRequest<DeleteItemResponse>({
        network,
        method: 'DELETE',
        backupId,
        pathSuffix: `/${key}`,
        deviceId,
    })

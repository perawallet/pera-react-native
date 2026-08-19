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

import { queryClient, type Network } from '@perawallet/wallet-core-shared'
import { buildBackupRequestProof } from '../crypto/buildBackupRequestProof'
import { withBackupAuthSecretKey } from '../credentials/keyStorage'
import type { BackupId, DeviceId } from '../models'
import { API_PREFIX, backupRoot } from './constants'

type SignedRequestParams<TData> = {
    network: Network
    method: 'GET' | 'POST' | 'PUT' | 'DELETE'
    backupId: BackupId
    pathSuffix: string
    deviceId: DeviceId
    data?: TData
    params?: object
    responseType?: 'json' | 'text'
}

export class BackupAuthKeyMissingError extends Error {
    constructor() {
        super('Backup auth key is not available in the keystore')
        this.name = 'BackupAuthKeyMissingError'
    }
}

export const signedBackupRequest = async <TResponse, TData = unknown>({
    network,
    method,
    backupId,
    pathSuffix,
    deviceId,
    data,
    params,
    responseType = 'json',
}: SignedRequestParams<TData>): Promise<TResponse> => {
    const decodedPath = `${API_PREFIX}/backup/${backupId}${pathSuffix}`
    const url = `${backupRoot(backupId)}${pathSuffix}`
    const body = data === undefined ? undefined : JSON.stringify(data)

    const proof = await withBackupAuthSecretKey(authSecretKey =>
        buildBackupRequestProof({
            method,
            path: decodedPath,
            body,
            authSecretKey,
        }),
    )
    if (!proof) {
        throw new BackupAuthKeyMissingError()
    }

    const response = await queryClient<TResponse>({
        backend: 'backup',
        network,
        method,
        url,
        ...(body !== undefined ? { body } : {}),
        ...(params ? { params } : {}),
        responseType,
        headers: {
            'x-backup-id': backupId,
            'x-device-id': deviceId,
            'x-nonce': proof.nonce,
            'x-signature': proof.signature,
        },
    })
    return response.data
}

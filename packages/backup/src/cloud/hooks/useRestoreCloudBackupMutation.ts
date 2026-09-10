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

import { useMutation, type UseMutationOptions } from '@tanstack/react-query'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import { useDeviceID } from '@perawallet/wallet-core-device'
import {
    restoreCloudBackup,
    type RestoreCloudBackupResult,
} from '../restore/restoreCloudBackup'
import type { Argon2idConfig } from '../models'
import { readCloudBackupRestoreMnemonic } from '../store/draftStore'
import { useCloudBackupStore } from '../store/store'
import { useBackupSyncStateStore } from '../store/syncStateStore'
import { useCloudBackupContactImport } from './useCloudBackupContactImport'
import { useCloudBackupImport } from './useCloudBackupImport'

export type RestoreCloudBackupVariables = {
    /** Base64 salt the UI calls the "encryption key". */
    salt: string
    /** Omitted for a manually entered salt: the phrase carries no parameters,
     *  so the backup is assumed to be on this build's defaults. */
    argon2id?: Argon2idConfig
}

/**
 * Pulls the remote backup for the phrase held in the restore draft and imports
 * it into the wallet. Rejects with a `CloudBackupRestoreError`; read its
 * category with `restoreErrorCategoryOf`.
 */
export const useRestoreCloudBackupMutation = (
    options?: UseMutationOptions<
        RestoreCloudBackupResult,
        Error,
        RestoreCloudBackupVariables
    >,
) => {
    const { network } = useNetwork()
    const deviceId = useDeviceID(network)
    const setConfigured = useCloudBackupStore(state => state.setConfigured)
    const setSyncState = useBackupSyncStateStore(state => state.setSyncState)
    const { importAccounts } = useCloudBackupImport()
    const { importContacts } = useCloudBackupContactImport()

    return useMutation({
        throwOnError: false,
        mutationFn: async ({
            salt,
            argon2id,
        }: RestoreCloudBackupVariables): Promise<RestoreCloudBackupResult> => {
            if (!deviceId) {
                throw new Error('Device ID is unavailable')
            }
            // Words live only for this call; the retained form stays the
            // zeroable index buffer in the draft store.
            const mnemonic = readCloudBackupRestoreMnemonic()
            if (!mnemonic) {
                throw new Error('Cloud backup restore phrase is missing')
            }
            const result = await restoreCloudBackup({
                mnemonic,
                salt,
                argon2id,
                deviceId,
                network,
                importAccounts,
                importContacts,
            })
            // The backup is registered server-side under exactly this device
            // id, and every later signed request has to reuse it.
            setConfigured({ backupId: result.backupId, salt, deviceId })
            setSyncState(result.syncState)
            return result
        },
        ...options,
    })
}

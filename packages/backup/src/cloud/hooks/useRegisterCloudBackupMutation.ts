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
    BackupDeviceIdUnavailableError,
    BackupDraftMissingError,
} from '../../errors'
import { registerCloudBackup } from '../credentials/registerCloudBackup'
import type { BackupId } from '../models'
import {
    readCloudBackupDraftMnemonic,
    useCloudBackupDraftStore,
} from '../store/draftStore'

export type RegisterCloudBackupMutationResult = {
    backupId: BackupId
}

/**
 * Claims the drafted credentials with the backup service. Nothing reaches the
 * device: the derived keys are retained in the volatile draft until the user
 * enables the backup on the store-key screen.
 */
export const useRegisterCloudBackupMutation = (
    options?: UseMutationOptions<
        RegisterCloudBackupMutationResult,
        Error,
        void
    >,
) => {
    const { network } = useNetwork()
    const deviceId = useDeviceID(network)
    const setRegistration = useCloudBackupDraftStore(
        state => state.setRegistration,
    )

    return useMutation({
        throwOnError: false,
        mutationFn: async (): Promise<RegisterCloudBackupMutationResult> => {
            // One snapshot: the store writes the phrase and salt together, so
            // reading them a render apart can pair a phrase with another
            // draft's salt and derive the wrong keys.
            const { salt } = useCloudBackupDraftStore.getState()
            const mnemonic = readCloudBackupDraftMnemonic()
            if (!mnemonic || !salt) {
                throw new BackupDraftMissingError()
            }
            if (!deviceId) {
                throw new BackupDeviceIdUnavailableError()
            }
            const { backupId, encryptionKey, authSecretKey, itemKey } =
                await registerCloudBackup({
                    mnemonic,
                    salt,
                    deviceId,
                    network,
                })
            const isRetained = setRegistration(
                { backupId, deviceId, encryptionKey, authSecretKey, itemKey },
                salt,
            )
            // The draft was cleared or replaced while the request was in
            // flight, so the keys are already zeroed. Reporting success here
            // would land the user on a store-key screen with nothing to enable.
            if (!isRetained) {
                throw new BackupDraftMissingError(
                    'Cloud backup draft changed before registration completed',
                )
            }
            return { backupId }
        },
        ...options,
    })
}

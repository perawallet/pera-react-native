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
import { BackupDraftMissingError } from '../../errors'
import { persistBackupKeys } from '../credentials/keyStorage'
import {
    readCloudBackupDraftMnemonic,
    useCloudBackupDraftStore,
} from '../store/draftStore'
import { useCloudBackupStore } from '../store/store'

/**
 * Turns a registered backup on: writes the retained keys to the device and
 * records the backup, which is what starts the sync manager.
 *
 * The device id comes from the registration rather than `useDeviceID`, so the
 * device the backup was registered under is the one recorded.
 */
export const useActivateCloudBackupMutation = (
    options?: UseMutationOptions<void, Error, void>,
) => {
    const clearDraft = useCloudBackupDraftStore(state => state.clearDraft)
    const setConfigured = useCloudBackupStore(state => state.setConfigured)

    return useMutation({
        throwOnError: false,
        mutationFn: async (): Promise<void> => {
            // One snapshot: the store zeroes a replaced draft's key buffers in
            // place, so a registration captured a render earlier can point at
            // zeroed keys while a freshly read phrase still looks valid.
            const { salt, registration } = useCloudBackupDraftStore.getState()
            const mnemonic = readCloudBackupDraftMnemonic()
            if (!mnemonic || !salt || !registration) {
                throw new BackupDraftMissingError(
                    'Cloud backup registration is missing',
                )
            }
            const {
                backupId,
                deviceId,
                encryptionKey,
                authSecretKey,
                itemKey,
            } = registration
            await persistBackupKeys({
                encryptionKey,
                authSecretKey,
                itemKey,
                mnemonic,
            })
            setConfigured({ backupId, salt, deviceId })
            clearDraft()
        },
        ...options,
    })
}

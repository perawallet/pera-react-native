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

import { useMutation } from '@tanstack/react-query'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import { useDeviceID } from '@perawallet/wallet-core-device'
import {
    CloudBackupRestoreError,
    readCloudBackupRestoreMnemonic,
    restoreCloudBackup,
    useBackupSyncStateStore,
    useCloudBackupStore,
    type ImportSummary,
    type RestoreErrorCategory,
} from '@perawallet/wallet-core-backup'
import { useCloudBackupImport } from './useCloudBackupImport'

type RestoreParams = { salt: string }

type UseRestoreCloudBackupParams = {
    onSuccess: (summary: ImportSummary) => void
    onError: (category: RestoreErrorCategory) => void
}

type UseRestoreCloudBackupResult = {
    restore: (params: RestoreParams) => void
    isRestoring: boolean
}

const categoryOf = (error: unknown): RestoreErrorCategory =>
    error instanceof CloudBackupRestoreError ? error.category : 'UNKNOWN'

export const useRestoreCloudBackup = ({
    onSuccess,
    onError,
}: UseRestoreCloudBackupParams): UseRestoreCloudBackupResult => {
    const { network } = useNetwork()
    const deviceId = useDeviceID(network)
    const setConfigured = useCloudBackupStore(state => state.setConfigured)
    const setSyncState = useBackupSyncStateStore(state => state.setSyncState)
    const { importAccounts } = useCloudBackupImport()

    const mutation = useMutation({
        throwOnError: false,
        mutationFn: async ({ salt }: RestoreParams) => {
            if (!deviceId) {
                throw new Error('Device ID is unavailable')
            }
            // Words live only for this call; the retained form stays the
            // zeroable index buffer in the draft store.
            const mnemonic = readCloudBackupRestoreMnemonic()
            if (!mnemonic) {
                throw new Error('Cloud backup restore phrase is missing')
            }
            const restored = await restoreCloudBackup({
                mnemonic,
                salt,
                deviceId,
                network,
                importAccounts,
            })
            // Pin the device id to this attempt: the backup is registered
            // server-side under exactly this id, and every later signed
            // request has to reuse it.
            return { ...restored, deviceId }
        },
        onSuccess: (
            { backupId, syncState, summary, deviceId: registeredDeviceId },
            { salt },
        ) => {
            setConfigured({ backupId, salt, deviceId: registeredDeviceId })
            setSyncState(syncState)
            onSuccess(summary)
        },
        onError: error => onError(categoryOf(error)),
    })

    return { restore: mutation.mutate, isRestoring: mutation.isPending }
}

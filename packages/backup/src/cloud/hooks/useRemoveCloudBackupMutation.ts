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
import { logger } from '@perawallet/wallet-core-shared'
import { destroyBackup } from '../api'
import { deleteBackupKeys } from '../credentials/keyStorage'
import { resolveBackupDeviceId } from '../store/resolveBackupDeviceId'
import { useCloudBackupStore } from '../store/store'
import { useBackupSyncStateStore } from '../store/syncStateStore'
import { getBackupSyncManager } from '../sync/backupSyncManager'

const warn = (message: string, error: unknown): void => {
    logger.warn(message, {
        error: error instanceof Error ? error.message : String(error),
    })
}

const stopSyncManager = (): void => {
    try {
        getBackupSyncManager().stop()
    } catch (error) {
        warn('useRemoveCloudBackupMutation: failed to stop sync manager', error)
    }
}

/**
 * The remote destroy runs first and the local teardown only follows a confirmed
 * one, so a failure leaves the device able to retry rather than dropping the
 * keys that reach a backup the server still holds.
 */
export const useRemoveCloudBackupMutation = (
    options?: UseMutationOptions<void, Error, void>,
) => {
    const { network } = useNetwork()
    const backupId = useCloudBackupStore(state => state.backupId)
    const resetCloudBackup = useCloudBackupStore(state => state.resetState)
    const resetSyncState = useBackupSyncStateStore(state => state.resetState)

    return useMutation({
        throwOnError: false,
        mutationFn: async (): Promise<void> => {
            const deviceId = resolveBackupDeviceId(network)
            if (!backupId || !deviceId) {
                throw new Error(
                    'useRemoveCloudBackupMutation: no backup configured on this device',
                )
            }

            await destroyBackup(network, backupId, deviceId)

            stopSyncManager()
            await deleteBackupKeys()
            resetCloudBackup()
            resetSyncState()
        },
        ...options,
    })
}

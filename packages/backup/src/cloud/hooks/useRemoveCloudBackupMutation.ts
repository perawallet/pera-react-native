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
import { logger, type Network } from '@perawallet/wallet-core-shared'
import { destroyBackup } from '../api'
import { deleteBackupKeys } from '../credentials/keyStorage'
import type { BackupId, DeviceId } from '../models'
import { useCloudBackupStore } from '../store/store'
import { useBackupSyncStateStore } from '../store/syncStateStore'
import { getBackupSyncManager } from '../sync/backupSyncManager'

const warn = (message: string, error: unknown): void => {
    logger.warn(message, {
        error: error instanceof Error ? error.message : String(error),
    })
}

/** False when the server still holds the backup, which is not fatal locally. */
const destroyRemoteBackup = async (
    network: Network,
    backupId: BackupId | null,
    deviceId: DeviceId | null,
): Promise<boolean> => {
    if (!backupId || !deviceId) return true
    try {
        await destroyBackup(network, backupId, deviceId)
        return true
    } catch (error) {
        warn('useRemoveCloudBackupMutation: remote destroy failed', error)
        return false
    }
}

const stopSyncManager = (): void => {
    try {
        getBackupSyncManager().stop()
    } catch (error) {
        warn('useRemoveCloudBackupMutation: failed to stop sync manager', error)
    }
}

export type RemoveCloudBackupMutationResult = {
    /** False when the remote backup survived the attempt and is now orphaned. */
    remoteOk: boolean
}

/**
 * Local teardown runs even when the remote destroy fails, so the user is always
 * freed from the backup on this device (mirrors Android's `DeleteBackup`).
 */
export const useRemoveCloudBackupMutation = (
    options?: UseMutationOptions<RemoveCloudBackupMutationResult, Error, void>,
) => {
    const { network } = useNetwork()
    const deviceId = useDeviceID(network)
    const backupId = useCloudBackupStore(state => state.backupId)
    const resetCloudBackup = useCloudBackupStore(state => state.resetState)
    const resetSyncState = useBackupSyncStateStore(state => state.resetState)

    return useMutation({
        throwOnError: false,
        mutationFn: async (): Promise<RemoveCloudBackupMutationResult> => {
            const remoteOk = await destroyRemoteBackup(
                network,
                backupId,
                deviceId,
            )
            stopSyncManager()
            await deleteBackupKeys()
            resetCloudBackup()
            resetSyncState()
            return { remoteOk }
        },
        ...options,
    })
}

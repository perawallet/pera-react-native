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

import { useCallback } from 'react'
import { useMutation, type UseMutationOptions } from '@tanstack/react-query'
import type { WalletMode } from '@perawallet/wallet-core-chain-contract'
import { useWalletDeployment } from '@perawallet/wallet-core-chain-shared'
import { logger } from '@perawallet/wallet-core-shared'
import { destroyBackup } from '../api'
import { deleteBackupKeys } from '../credentials/keyStorage'
import { resolveBackupDeviceId } from '../store/resolveBackupDeviceId'
import { useCloudBackupStore } from '../store/store'
import { useBackupSyncActivityStore } from '../store/syncActivityStore'
import { useBackupSyncStateStore } from '../store/syncStateStore'
import { getBackupSyncManager } from '../sync/backupSyncManager'

const warn = (message: string, error: unknown): void => {
    logger.warn(message, {
        error: error instanceof Error ? error.message : String(error),
    })
}

/** The destroy queues behind the server's per-backup write lock, which this
 *  device's own sync would otherwise keep taking. */
const suspendSyncManager = async (): Promise<() => void> => {
    try {
        const resume = await getBackupSyncManager().suspend()
        return () => {
            resume().catch(error =>
                warn(
                    'useRemoveCloudBackupMutation: failed to resume sync',
                    error,
                ),
            )
        }
    } catch (error) {
        warn('useRemoveCloudBackupMutation: failed to stop sync manager', error)
        return () => {}
    }
}

// TanStack swaps a pending mutation's options on every render, so the deployment travels in the variables.
type RemoveCloudBackupVariables = { deployment: WalletMode }

export type UseRemoveCloudBackupMutationResult = {
    mutate: () => void
    isPending: boolean
}

/**
 * The remote destroy runs first and the local teardown only follows a confirmed
 * one, so a failure leaves the device able to retry rather than dropping the
 * keys that reach a backup the server still holds.
 */
export const useRemoveCloudBackupMutation = (
    options?: UseMutationOptions<void, Error, RemoveCloudBackupVariables>,
): UseRemoveCloudBackupMutationResult => {
    const deployment = useWalletDeployment()
    const backupId = useCloudBackupStore(state => state.backupId)
    const resetCloudBackup = useCloudBackupStore(state => state.resetState)
    const resetSyncState = useBackupSyncStateStore(state => state.resetState)
    const resetSyncActivity = useBackupSyncActivityStore(
        state => state.resetState,
    )

    const { mutate, isPending } = useMutation({
        throwOnError: false,
        mutationFn: async ({
            deployment,
        }: RemoveCloudBackupVariables): Promise<void> => {
            const deviceId = resolveBackupDeviceId(deployment)
            if (!backupId || !deviceId) {
                throw new Error(
                    'useRemoveCloudBackupMutation: no backup configured on this device',
                )
            }

            const resumeSync = await suspendSyncManager()
            try {
                await destroyBackup(backupId, deviceId)
            } catch (error) {
                resumeSync()
                throw error
            }

            await deleteBackupKeys()
            resetCloudBackup()
            resetSyncState()
            resetSyncActivity()
        },
        ...options,
    })

    const remove = useCallback(
        () => mutate({ deployment }),
        [mutate, deployment],
    )

    return { mutate: remove, isPending }
}

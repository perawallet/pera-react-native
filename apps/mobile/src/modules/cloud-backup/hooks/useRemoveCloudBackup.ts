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
import {
    deleteBackupKeys,
    destroyBackup,
    getBackupSyncManager,
    resolveBackupDeviceId,
    useCloudBackupStore,
} from '@perawallet/wallet-core-backup'
import { logger } from '@perawallet/wallet-core-shared'
import { useLanguage } from '@hooks/useLanguage'
import { useToast } from '@hooks/useToast'
import { useCloudBackupTeardown } from './useCloudBackupTeardown'

const warn = (message: string, error: unknown): void => {
    logger.warn(message, {
        error: error instanceof Error ? error.message : String(error),
    })
}

const stopSyncManager = (): void => {
    try {
        getBackupSyncManager().stop()
    } catch (error) {
        warn('useRemoveCloudBackup: failed to stop sync manager', error)
    }
}

type UseRemoveCloudBackupResult = {
    /**
     * The remote destroy runs first and the local teardown only follows a
     * confirmed one, so a failure leaves the device able to retry rather than
     * dropping the keys that reach a backup the server still holds.
     */
    removeBackup: () => void
    isRemoving: boolean
}

export const useRemoveCloudBackup = (): UseRemoveCloudBackupResult => {
    const { t } = useLanguage()
    const { showToast } = useToast()
    const { network } = useNetwork()
    const backupId = useCloudBackupStore(state => state.backupId)
    const { resetLocalState, goHome } = useCloudBackupTeardown()

    const mutation = useMutation({
        throwOnError: false,
        mutationFn: async (): Promise<void> => {
            const deviceId = resolveBackupDeviceId(network)
            if (!backupId || !deviceId) {
                throw new Error(
                    'useRemoveCloudBackup: no backup configured on this device',
                )
            }

            await destroyBackup(network, backupId, deviceId)

            stopSyncManager()
            await deleteBackupKeys()
            resetLocalState()
        },
        onSuccess: () => {
            showToast({
                title: t('cloud_backup.turn_off_and_remove.success'),
                body: '',
                type: 'success',
            })
            goHome()
        },
        onError: error => {
            warn('useRemoveCloudBackup: remove failed', error)
            showToast({
                title: t('cloud_backup.turn_off_and_remove.error'),
                body: '',
                type: 'error',
            })
        },
    })

    return { removeBackup: mutation.mutate, isRemoving: mutation.isPending }
}

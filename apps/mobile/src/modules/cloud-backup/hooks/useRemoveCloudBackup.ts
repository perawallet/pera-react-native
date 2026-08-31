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
    deleteBackupKeys,
    destroyBackup,
    getBackupSyncManager,
    useCloudBackupStore,
} from '@perawallet/wallet-core-backup'
import { logger, type Network } from '@perawallet/wallet-core-shared'
import { useLanguage } from '@hooks/useLanguage'
import { useToast } from '@hooks/useToast'
import { useCloudBackupTeardown } from './useCloudBackupTeardown'

const warn = (message: string, error: unknown): void => {
    logger.warn(message, {
        error: error instanceof Error ? error.message : String(error),
    })
}

/** False when the server still holds the backup, which is not fatal locally. */
const destroyRemoteBackup = async (
    network: Network,
    backupId: string | null,
    deviceId: string | null,
): Promise<boolean> => {
    if (!backupId || !deviceId) return true
    try {
        await destroyBackup(network, backupId, deviceId)
        return true
    } catch (error) {
        warn('useRemoveCloudBackup: remote destroy failed', error)
        return false
    }
}

type Translate = ReturnType<typeof useLanguage>['t']

const removalToast = (t: Translate, remoteOk: boolean) => ({
    title: remoteOk
        ? t('cloud_backup.turn_off_and_remove.success')
        : t('cloud_backup.turn_off_and_remove.partial'),
    body: '',
    type: remoteOk ? ('success' as const) : ('error' as const),
})

const stopSyncManager = (): void => {
    try {
        getBackupSyncManager().stop()
    } catch (error) {
        warn('useRemoveCloudBackup: failed to stop sync manager', error)
    }
}

type UseRemoveCloudBackupResult = {
    /**
     * Local teardown runs even when the remote destroy fails, so the user is
     * always freed from the backup on this device (mirrors Android's
     * `DeleteBackup`). The remote backup may be briefly orphaned in that case.
     */
    removeBackup: () => void
    isRemoving: boolean
}

export const useRemoveCloudBackup = (): UseRemoveCloudBackupResult => {
    const { t } = useLanguage()
    const { showToast } = useToast()
    const { network } = useNetwork()
    const deviceId = useDeviceID(network)
    const backupId = useCloudBackupStore(state => state.backupId)
    const { resetLocalState, goHome } = useCloudBackupTeardown()

    const mutation = useMutation({
        throwOnError: false,
        mutationFn: async (): Promise<{ remoteOk: boolean }> => {
            const remoteOk = await destroyRemoteBackup(
                network,
                backupId,
                deviceId,
            )
            stopSyncManager()
            await deleteBackupKeys()
            resetLocalState()
            return { remoteOk }
        },
        onSuccess: ({ remoteOk }) => {
            showToast(removalToast(t, remoteOk))
            goHome()
        },
        onError: () => {
            // Local teardown failed, so state may be inconsistent — no navigation.
            showToast({
                title: t('cloud_backup.turn_off_and_remove.error'),
                body: '',
                type: 'error',
            })
        },
    })

    return { removeBackup: mutation.mutate, isRemoving: mutation.isPending }
}

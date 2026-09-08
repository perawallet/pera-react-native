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

import { useRemoveCloudBackupMutation } from '@perawallet/wallet-core-backup'
import { useLanguage } from '@hooks/useLanguage'
import { useToast } from '@hooks/useToast'
import { useGoToCloudBackupHome } from './useGoToCloudBackupHome'

type Translate = ReturnType<typeof useLanguage>['t']

const removalToast = (t: Translate, remoteOk: boolean) => ({
    title: remoteOk
        ? t('cloud_backup.turn_off_and_remove.success')
        : t('cloud_backup.turn_off_and_remove.partial'),
    body: '',
    type: remoteOk ? ('success' as const) : ('error' as const),
})

type UseRemoveCloudBackupResult = {
    /**
     * Local teardown runs even when the remote destroy fails, so the user is
     * always freed from the backup on this device. The remote backup may be
     * briefly orphaned in that case.
     */
    removeBackup: () => void
    isRemoving: boolean
}

export const useRemoveCloudBackup = (): UseRemoveCloudBackupResult => {
    const { t } = useLanguage()
    const { showToast } = useToast()
    const goHome = useGoToCloudBackupHome()

    const mutation = useRemoveCloudBackupMutation({
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

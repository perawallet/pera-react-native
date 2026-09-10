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
import { logger } from '@perawallet/wallet-core-shared'
import { useLanguage } from '@hooks/useLanguage'
import { useToast } from '@hooks/useToast'
import { useGoToCloudBackupHome } from './useGoToCloudBackupHome'

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
    const goHome = useGoToCloudBackupHome()

    const mutation = useRemoveCloudBackupMutation({
        onSuccess: () => {
            showToast({
                title: t('cloud_backup.turn_off_and_remove.success'),
                body: '',
                type: 'success',
            })
            goHome()
        },
        onError: error => {
            logger.warn('useRemoveCloudBackup: remove failed', {
                error: error.message,
            })
            showToast({
                title: t('cloud_backup.turn_off_and_remove.error'),
                body: '',
                type: 'error',
            })
        },
    })

    return { removeBackup: mutation.mutate, isRemoving: mutation.isPending }
}

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
import { deleteBackupKeys } from '@perawallet/wallet-core-backup'
import { useLanguage } from '@hooks/useLanguage'
import { useToast } from '@hooks/useToast'
import { useCloudBackupTeardown } from './useCloudBackupTeardown'

type UseDisableCloudBackupResult = {
    /** Local only — leaves the remote backup intact. */
    disableBackup: () => void
    isDisabling: boolean
}

export const useDisableCloudBackup = (): UseDisableCloudBackupResult => {
    const { t } = useLanguage()
    const { showToast } = useToast()
    const { resetLocalState, goHome } = useCloudBackupTeardown()

    const mutation = useMutation({
        throwOnError: false,
        mutationFn: () => deleteBackupKeys(),
        onSuccess: () => {
            resetLocalState()
            showToast({
                title: t('cloud_backup.turn_off.success'),
                body: '',
                type: 'success',
            })
            goHome()
        },
        onError: () => {
            showToast({
                title: t('cloud_backup.turn_off.error'),
                body: '',
                type: 'error',
            })
        },
    })

    return { disableBackup: mutation.mutate, isDisabling: mutation.isPending }
}

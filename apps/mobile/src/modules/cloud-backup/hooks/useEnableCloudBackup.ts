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

import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useEnableCloudBackupMutation } from '@perawallet/wallet-core-backup'
import { useLanguage } from '@hooks/useLanguage'
import { useToast } from '@hooks/useToast'
import type { CloudBackupStackParamList } from '../routes/types'

type UseEnableCloudBackupResult = {
    enableBackup: () => void
    isEnabling: boolean
}

export const useEnableCloudBackup = (): UseEnableCloudBackupResult => {
    const { t } = useLanguage()
    const { showToast } = useToast()
    const navigation =
        useNavigation<NativeStackNavigationProp<CloudBackupStackParamList>>()

    const mutation = useEnableCloudBackupMutation({
        onSuccess: () => {
            showToast({
                title: t('cloud_backup.enable.success'),
                body: '',
                type: 'success',
            })
            navigation.reset({
                index: 0,
                routes: [{ name: 'CloudBackupOverview' }],
            })
        },
        onError: () => {
            showToast({
                title: t('cloud_backup.enable.error'),
                body: '',
                type: 'error',
            })
        },
    })

    return { enableBackup: mutation.mutate, isEnabling: mutation.isPending }
}

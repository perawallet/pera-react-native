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
import { useRegisterCloudBackupMutation } from '@perawallet/wallet-core-backup'
import { useLanguage } from '@hooks/useLanguage'
import { useToast } from '@hooks/useToast'
import type { CloudBackupStackParamList } from '../routes/types'

type UseRegisterCloudBackupResult = {
    registerBackup: () => void
    isRegistering: boolean
}

export const useRegisterCloudBackup = (): UseRegisterCloudBackupResult => {
    const { t } = useLanguage()
    const { showToast } = useToast()
    const navigation =
        useNavigation<NativeStackNavigationProp<CloudBackupStackParamList>>()

    const mutation = useRegisterCloudBackupMutation({
        // `replace`: unmounting the quiz drops the resolved plaintext words it
        // holds in state; a push would keep them live behind the next screen.
        onSuccess: () => navigation.replace('CloudBackupStoreEncryptionKey'),
        onError: () => {
            showToast({
                title: t('cloud_backup.enable.error'),
                body: '',
                type: 'error',
            })
        },
    })

    return {
        registerBackup: mutation.mutate,
        isRegistering: mutation.isPending,
    }
}

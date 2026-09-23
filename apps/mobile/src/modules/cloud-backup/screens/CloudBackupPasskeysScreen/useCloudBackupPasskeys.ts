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
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { BackupPasskey } from '@perawallet/wallet-core-backup'
import { useBackupPasskeyReview } from '../../hooks/useBackupPasskeyReview'
import type { CloudBackupStackParamList } from '../../routes/types'

type UseCloudBackupPasskeysResult = {
    passkeys: BackupPasskey[]
    isBackedUp: (credentialId: string) => boolean
    isLoading: boolean
    notBackedUpCount: number
    availableFromBackupCount: number
    busyCredentialId: string | null
    onBackUp: (credentialId: string) => void
    onReview: () => void
}

export const useCloudBackupPasskeys = (): UseCloudBackupPasskeysResult => {
    const navigation =
        useNavigation<NativeStackNavigationProp<CloudBackupStackParamList>>()
    const {
        passkeys,
        isBackedUp,
        isLoading,
        notBackedUpPasskeys,
        availableFromBackup,
        busyCredentialId,
        backUpPasskey,
    } = useBackupPasskeyReview()

    return {
        passkeys,
        isBackedUp,
        isLoading,
        notBackedUpCount: notBackedUpPasskeys.length,
        availableFromBackupCount: availableFromBackup.length,
        busyCredentialId,
        onBackUp: backUpPasskey,
        onReview: useCallback(
            () => navigation.navigate('CloudBackupPasskeysReview'),
            [navigation],
        ),
    }
}

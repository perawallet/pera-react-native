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
import {
    useAccountsStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { useBackupAccountReview } from '../../hooks/useBackupAccountReview'
import type { CloudBackupStackParamList } from '../../routes/types'

type UseCloudBackupAccountsResult = {
    accounts: WalletAccount[]
    isBackedUp: (address: string) => boolean
    notBackedUpCount: number
    availableFromBackupCount: number
    busyAddress: string | null
    onBackUp: (address: string) => void
    onReview: () => void
}

export const useCloudBackupAccounts = (): UseCloudBackupAccountsResult => {
    const navigation =
        useNavigation<NativeStackNavigationProp<CloudBackupStackParamList>>()
    const accounts = useAccountsStore(state => state.accounts)
    const {
        isBackedUp,
        notBackedUpAccounts,
        availableFromBackup,
        busyAddress,
        backUpAccount,
    } = useBackupAccountReview()

    const onReview = useCallback(
        () => navigation.navigate('CloudBackupAccountsReview'),
        [navigation],
    )

    return {
        accounts,
        isBackedUp,
        notBackedUpCount: notBackedUpAccounts.length,
        availableFromBackupCount: availableFromBackup.length,
        busyAddress,
        onBackUp: backUpAccount,
        onReview,
    }
}

/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { useCallback, useMemo } from 'react'
import * as Haptics from 'expo-haptics'
import {
    useNavigation,
    useRoute,
    type RouteProp,
} from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import {
    useAccountsStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { useMarkBackupComplete } from '@perawallet/wallet-core-backup'
import { useLanguage } from '@hooks/useLanguage'
import { useToast } from '@hooks/useToast'
import { useBackupFlowWords } from '../../context'
import { useBackupQuiz, type BackupQuizItem } from '../../hooks'
import type { BackupStackParamList } from '../../routes/types'

export type UseBackupVerificationScreenResult = {
    items: BackupQuizItem[]
    onSelect: (questionIdx: number, word: string) => void
    onSubmit: () => void
    isFilled: boolean
    hasAccount: boolean
}

export const useBackupVerificationScreen =
    (): UseBackupVerificationScreenResult => {
        const navigation =
            useNavigation<
                NativeStackNavigationProp<
                    BackupStackParamList,
                    'BackupVerification'
                >
            >()
        const route =
            useRoute<RouteProp<BackupStackParamList, 'BackupVerification'>>()
        const accounts = useAccountsStore(
            (state: { accounts: WalletAccount[] }) => state.accounts,
        )

        const address = route.params?.address
        const account = useMemo<WalletAccount | null>(() => {
            if (!address) return null
            return accounts.find(a => a.address === address) ?? null
        }, [address, accounts])

        const { getWords } = useBackupFlowWords()
        const words = useMemo(() => getWords() ?? [], [getWords])

        const markBackupComplete = useMarkBackupComplete()
        const { t } = useLanguage()
        const { showToast } = useToast()

        const onSuccess = useCallback(() => {
            if (account) markBackupComplete(account)
            navigation.replace('BackupSuccess')
        }, [account, markBackupComplete, navigation])

        const onWrong = useCallback(() => {
            void Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Error,
            )
            showToast({
                title: t('backup.verification.error_message'),
                body: '',
                type: 'error',
            })
        }, [showToast, t])

        const { items, onSelect, onSubmit, isFilled } = useBackupQuiz(
            words,
            onSuccess,
            onWrong,
        )

        return {
            items,
            onSelect,
            onSubmit,
            isFilled,
            hasAccount: account !== null,
        }
    }

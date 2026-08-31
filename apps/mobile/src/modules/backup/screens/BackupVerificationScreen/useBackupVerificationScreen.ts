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

import { useCallback, useEffect, useMemo } from 'react'
import * as Haptics from 'expo-haptics'
import { trackEvent, OnboardingEvent } from '@analytics'
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
import { useMarkMnemonicBackupComplete } from '@perawallet/wallet-core-backup'
import { MNEMONIC_WORDLIST } from '@perawallet/wallet-core-kms'
import { useLanguage } from '@hooks/useLanguage'
import { useToast } from '@hooks/useToast'
import {
    useBackupQuiz,
    useRandomMnemonicForAddress,
    type BackupQuizQuestion,
} from '../../hooks'
import type { BackupStackParamList } from '../../routes/types'

const VERIFICATION_WORD_COUNT = 3

export type UseBackupVerificationScreenResult = {
    items: BackupQuizQuestion[]
    onSelect: (questionIdx: number, word: string) => void
    onSubmit: () => void
    isFilled: boolean
    hasAccount: boolean
    isLoading: boolean
    error: Error | null
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

        const { picks, isLoading, error } = useRandomMnemonicForAddress(
            address,
            account,
            VERIFICATION_WORD_COUNT,
        )

        const markBackupComplete = useMarkMnemonicBackupComplete()
        const { t } = useLanguage()
        const { showToast } = useToast()

        useEffect(() => {
            trackEvent(OnboardingEvent.VerifyPassphrase)
        }, [])

        const onSuccess = useCallback(() => {
            trackEvent(OnboardingEvent.VerifyPassphraseComplete)
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

        const correctPairs = useMemo(() => picks ?? [], [picks])

        const { items, onSelect, onSubmit, isFilled } = useBackupQuiz(
            correctPairs,
            MNEMONIC_WORDLIST,
            onSuccess,
            onWrong,
        )

        return {
            items,
            onSelect,
            onSubmit,
            isFilled,
            hasAccount: account !== null,
            isLoading,
            error,
        }
    }

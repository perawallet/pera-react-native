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

import { useCallback, useEffect, useMemo } from 'react'
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
import { useBackupFlowWords } from '../../context'
import { useBackupVerification } from '../../hooks'
import type { BackupStackParamList } from '../../routes/types'

export type UseBackupVerificationScreenResult = {
    slots: (string | null)[]
    poolWords: string[]
    onTapPoolWord: (word: string, i: number) => void
    onTapSlot: (i: number) => void
    onFinish: () => void
    onStartOver: () => void
    isFilled: boolean
    validationError: boolean
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

        const onSuccess = useCallback(() => {
            if (account) markBackupComplete(account)
            navigation.replace('BackupSuccess')
        }, [account, markBackupComplete, navigation])

        const verification = useBackupVerification(words, onSuccess)

        useEffect(() => {
            if (verification.validationError) {
                void Haptics.notificationAsync(
                    Haptics.NotificationFeedbackType.Error,
                )
            }
        }, [verification.validationError])

        return {
            slots: verification.orderedSlots,
            poolWords: verification.poolWords,
            onTapPoolWord: verification.onTapPoolWord,
            onTapSlot: verification.onTapSlot,
            onFinish: verification.onFinish,
            onStartOver: verification.onStartOver,
            isFilled: verification.isFilled,
            validationError: verification.validationError,
            hasAccount: account !== null,
        }
    }

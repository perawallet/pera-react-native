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
import { Share } from 'react-native'

import { useToast } from '@hooks/useToast'
import { useClipboard } from '@hooks/useClipboard'
import { useDeepLink } from '@hooks/useDeepLink'
import { useLanguage } from '@hooks/useLanguage'
import { config } from '@perawallet/wallet-core-config'
import { bottomSheetNotifier } from '@components/core'
import {
    getAccountDisplayName,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { useReceiveFunds } from '@modules/transactions/hooks'
import { ReceiveFundsStackParamList } from '@modules/transactions/routes/receive-funds/types'
import { StackNavigationProp } from '@react-navigation/stack'
import { useNavigation } from '@react-navigation/native'

type UseQRViewScreenResult = {
    account?: WalletAccount
    deeplink: string
    handleBack: () => void
    handleCopyAddress: () => void
    handleShareAddress: () => Promise<void>
}

export const useQRViewScreen = (
    onFinished?: () => void,
): UseQRViewScreenResult => {
    const { selectedAccount, canSelectAccount } = useReceiveFunds()
    const { t } = useLanguage()
    const { showToast } = useToast()
    const { copyToClipboard } = useClipboard()
    const { buildAccountDeeplink } = useDeepLink()
    const navigation =
        useNavigation<StackNavigationProp<ReceiveFundsStackParamList>>()

    const deeplink = useMemo(() => {
        if (!selectedAccount) {
            return ''
        }
        return buildAccountDeeplink(selectedAccount)
    }, [selectedAccount, buildAccountDeeplink])

    const handleCopyAddress = useCallback(() => {
        copyToClipboard(selectedAccount?.address ?? '')
    }, [copyToClipboard, selectedAccount?.address])

    const handleBack = useCallback(() => {
        if (canSelectAccount) {
            navigation.goBack()
        } else {
            onFinished?.()
        }
    }, [canSelectAccount, navigation, onFinished])

    const handleShareAddress = useCallback(async () => {
        try {
            if (!selectedAccount) {
                return
            }
            await Share.share({
                title: getAccountDisplayName(selectedAccount),
                message: selectedAccount.address,
            })
        } catch (error) {
            showToast(
                {
                    title: t('errors.general.title'),
                    body: config.debugEnabled
                        ? `${error}`
                        : t('errors.general.body'),
                    type: 'error',
                },
                {
                    notifier: bottomSheetNotifier.current ?? undefined,
                },
            )
        }
    }, [selectedAccount, showToast, t])

    return {
        account: selectedAccount,
        deeplink,
        handleBack,
        handleCopyAddress,
        handleShareAddress,
    }
}

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

import { useCallback, useMemo } from 'react'

import {
    chainAccountOf,
    getAccountDisplayName,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { LEGACY_CHAIN_ID } from '@perawallet/wallet-core-chain-contract'
import type { Optional } from '@perawallet/wallet-core-shared'
import { shareText } from '@utils/shareText'
import { useErrorToast } from '@hooks/useErrorToast'
import { useClipboard } from '@hooks/useClipboard'
import { useDeepLink } from '@modules/deeplink'
import { useLanguage } from '@hooks/useLanguage'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { bottomSheetNotifier } from '@components/core'
import { useReceiveFunds } from '@modules/transactions/hooks'

type UseQRViewScreenResult = {
    account: Optional<WalletAccount>
    address: string
    deeplink: string
    /**
     * True when the user reached this screen via AccountSelection — the
     * header back button navigates back to the picker. False when QRView is
     * the initial route and back must dismiss the whole flow.
     */
    canSelectAccount: boolean
    handleBack: () => void
    handleCopyAddress: () => void
    handleShareAddress: () => Promise<void>
}

export const useQRViewScreen = (): UseQRViewScreenResult => {
    const { selectedAccount, canSelectAccount, onFinished } = useReceiveFunds()
    const navigation = useAppNavigation()
    const { t } = useLanguage()
    const { showError } = useErrorToast()
    const { copyToClipboard } = useClipboard()
    const { buildAccountDeeplink } = useDeepLink()
    const address = selectedAccount
        ? (chainAccountOf(selectedAccount, LEGACY_CHAIN_ID)?.address ?? '')
        : ''

    const deeplink = useMemo(() => {
        if (!selectedAccount) {
            return ''
        }
        return buildAccountDeeplink(selectedAccount, LEGACY_CHAIN_ID)
    }, [selectedAccount, buildAccountDeeplink])

    const handleCopyAddress = useCallback(() => {
        void copyToClipboard(address)
    }, [copyToClipboard, address])

    const handleShareAddress = useCallback(async () => {
        try {
            if (!selectedAccount) {
                return
            }
            await shareText({
                title: getAccountDisplayName(selectedAccount, LEGACY_CHAIN_ID),
                message: address,
            })
        } catch (error) {
            showError(error, t('errors.general.title'), {
                notifier: bottomSheetNotifier.current ?? undefined,
            })
        }
    }, [selectedAccount, address, showError, t])

    const handleBack = useCallback(() => {
        if (canSelectAccount) {
            navigation.goBack()
        } else {
            onFinished?.()
        }
    }, [canSelectAccount, navigation, onFinished])

    return {
        account: selectedAccount,
        address,
        deeplink,
        canSelectAccount,
        handleBack,
        handleCopyAddress,
        handleShareAddress,
    }
}

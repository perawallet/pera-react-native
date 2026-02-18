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

import { useCallback, useMemo, useState } from 'react'
import { useAppNavigation } from '@hooks/useAppNavigation'
import {
    useCreateAccount,
    useAllAccounts,
    AccountTypes,
    HDWalletAccount,
} from '@perawallet/wallet-core-accounts'
import { useModalState } from '@hooks/useModalState'
import { useToast } from '@hooks/useToast'
import { useLanguage } from '@hooks/useLanguage'
import { deferToNextCycle } from '@perawallet/wallet-core-shared'
import { useWebView } from '@modules/webview'
import { config } from '@perawallet/wallet-core-config'

type UseAddAccountScreenResult = {
    hasHDWallet: boolean
    isCreatingAccount: boolean
    isImportOptionsVisible: boolean
    isOtherOptionsVisible: boolean
    handleClose: () => void
    handleAddAccount: () => void
    handleImportAccount: () => void
    handleCloseImportOptions: () => void
    handleHDWalletPress: () => void
    handleAlgo25Press: () => void
    handleWatchAddress: () => void
    handleCreateUniversalWallet: () => void
    handleCreateAlgo25: () => void
    handleTermsPress: () => void
    handlePrivacyPress: () => void
    handleToggleOtherOptions: () => void
}

export const useAddAccountScreen = (): UseAddAccountScreenResult => {
    const navigation = useAppNavigation()
    const accounts = useAllAccounts()
    const createAccount = useCreateAccount()
    const { showToast } = useToast()
    const { t } = useLanguage()
    const { pushWebView } = useWebView()
    const {
        isOpen: isImportOptionsVisible,
        open: openImportOptions,
        close: closeImportOptions,
    } = useModalState()

    const {
        isOpen: isCreatingAccount,
        open: openCreatingAccount,
        close: closeCreatingAccount,
    } = useModalState()

    const hdWalletAccounts = useMemo(
        () =>
            accounts.filter(
                (a): a is HDWalletAccount => a.type === AccountTypes.hdWallet,
            ),
        [accounts],
    )

    const hasHDWallet = hdWalletAccounts.length > 0
    const [isOtherOptionsVisible, setIsOtherOptionsVisible] = useState(false)

    const handleClose = useCallback(() => {
        navigation.goBack()
    }, [navigation])

    const handleAddAccount = useCallback(() => {
        if (hdWalletAccounts.length === 0) return

        openCreatingAccount()
        deferToNextCycle(async () => {
            try {
                const firstHDAccount = hdWalletAccounts[0]
                const walletId = firstHDAccount.hdWalletDetails.walletId

                const sameWalletAccounts = hdWalletAccounts.filter(
                    a => a.hdWalletDetails.walletId === walletId,
                )
                const nextKeyIndex =
                    Math.max(
                        ...sameWalletAccounts.map(
                            a => a.hdWalletDetails.keyIndex,
                        ),
                    ) + 1

                const newAccount = await createAccount({
                    walletId,
                    account: 0,
                    keyIndex: nextKeyIndex,
                })
                navigation.push('NameAccount', { account: newAccount })
            } catch (error) {
                showToast({
                    title: t('onboarding.create_account.error_title'),
                    body: t('onboarding.create_account.error_message', {
                        error: `${error}`,
                    }),
                    type: 'error',
                })
            } finally {
                closeCreatingAccount()
            }
        })
    }, [
        hdWalletAccounts,
        openCreatingAccount,
        closeCreatingAccount,
        createAccount,
        navigation,
        showToast,
        t,
    ])

    const handleImportAccount = useCallback(() => {
        openImportOptions()
    }, [openImportOptions])

    const handleCloseImportOptions = useCallback(() => {
        closeImportOptions()
    }, [closeImportOptions])

    const handleHDWalletPress = useCallback(() => {
        closeImportOptions()
        navigation.push('ImportInfo', { accountType: 'hdWallet' })
    }, [closeImportOptions, navigation])

    const handleAlgo25Press = useCallback(() => {
        closeImportOptions()
        navigation.push('ImportInfo', { accountType: 'algo25' })
    }, [closeImportOptions, navigation])

    const handleToggleOtherOptions = useCallback(() => {
        setIsOtherOptionsVisible(prev => !prev)
    }, [])

    const handleTermsPress = useCallback(() => {
        pushWebView({
            url: config.termsOfServiceUrl,
            id: 'terms-of-service',
        })
    }, [pushWebView])

    const handlePrivacyPress = useCallback(() => {
        pushWebView({
            url: config.privacyPolicyUrl,
            id: 'privacy-policy',
        })
    }, [pushWebView])

    const handleWatchAddress = useCallback(() => {
        navigation.push('WatchAccount')
    }, [navigation])

    const handleCreateUniversalWallet = useCallback(() => {
        openCreatingAccount()
        deferToNextCycle(async () => {
            try {
                const newAccount = await createAccount({
                    account: 0,
                    keyIndex: 0,
                })
                navigation.push('NameAccount', { account: newAccount })
            } catch (error) {
                showToast({
                    title: t('onboarding.create_account.error_title'),
                    body: t('onboarding.create_account.error_message', {
                        error: `${error}`,
                    }),
                    type: 'error',
                })
            } finally {
                closeCreatingAccount()
            }
        })
    }, [
        openCreatingAccount,
        closeCreatingAccount,
        createAccount,
        navigation,
        showToast,
        t,
    ])

    const handleCreateAlgo25 = useCallback(() => {
        openCreatingAccount()
        deferToNextCycle(async () => {
            try {
                const newAccount = await createAccount({
                    account: 0,
                    keyIndex: 0,
                    type: 'algo25',
                })
                navigation.push('NameAccount', { account: newAccount })
            } catch (error) {
                showToast({
                    title: t('onboarding.create_account.error_title'),
                    body: t('onboarding.create_account.error_message', {
                        error: `${error}`,
                    }),
                    type: 'error',
                })
            } finally {
                closeCreatingAccount()
            }
        })
    }, [
        openCreatingAccount,
        closeCreatingAccount,
        createAccount,
        navigation,
        showToast,
        t,
    ])

    return {
        hasHDWallet,
        isCreatingAccount,
        isImportOptionsVisible,
        handleClose,
        handleAddAccount,
        handleImportAccount,
        handleCloseImportOptions,
        handleHDWalletPress,
        handleAlgo25Press,
        handleWatchAddress,
        handleCreateUniversalWallet,
        handleCreateAlgo25,
        handleTermsPress,
        handlePrivacyPress,
        isOtherOptionsVisible,
        handleToggleOtherOptions,
    }
}

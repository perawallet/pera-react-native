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
    useCreateNextHDAccount,
} from '@perawallet/wallet-core-accounts'
import { useModalState } from '@hooks/useModalState'
import { useToast } from '@hooks/useToast'
import { useLanguage } from '@hooks/useLanguage'
import { deferToNextCycle } from '@perawallet/wallet-core-shared'
import { useWebView } from '@modules/webview'
import { config } from '@perawallet/wallet-core-config'
import { type IconName } from '@components/core'

export type AccountOption = {
    testID: string
    titleKey: string
    descriptionKey: string
    leftIcon: IconName
    onPress: () => void
    isDisabled?: boolean
}

type UseAddAccountScreenResult = {
    isCreatingAccount: boolean
    isImportOptionsVisible: boolean
    isOtherOptionsVisible: boolean
    mainOptions: AccountOption[]
    otherOptions: AccountOption[]
    handleClose: () => void
    handleImportAccount: () => void
    handleCloseImportOptions: () => void
    handleHDWalletPress: () => void
    handleAlgo25Press: () => void
    handleTermsPress: () => void
    handlePrivacyPress: () => void
    handleToggleOtherOptions: () => void
}

export const useAddAccountScreen = (): UseAddAccountScreenResult => {
    const navigation = useAppNavigation()
    const { createHdWalletAccount, createAlgo25WalletAccount } =
        useCreateAccount()
    const { createNextHDAccount, hasHDWallet } = useCreateNextHDAccount()
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

    const [isOtherOptionsVisible, setIsOtherOptionsVisible] = useState(false)

    const handleClose = useCallback(() => {
        navigation.goBack()
    }, [navigation])

    const handleAddAccount = useCallback(() => {
        if (!hasHDWallet) return

        openCreatingAccount()
        deferToNextCycle(async () => {
            try {
                const newAccount = await createNextHDAccount()
                if (newAccount) {
                    navigation.push('NameAccount', { account: newAccount })
                }
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
        hasHDWallet,
        createNextHDAccount,
        openCreatingAccount,
        closeCreatingAccount,
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
                const newAccount = await createHdWalletAccount({
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
        createHdWalletAccount,
        navigation,
        showToast,
        t,
    ])

    const handleCreateAlgo25 = useCallback(() => {
        openCreatingAccount()
        deferToNextCycle(async () => {
            try {
                const newAccount = await createAlgo25WalletAccount({})
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
        createAlgo25WalletAccount,
        navigation,
        showToast,
        t,
    ])

    const mainOptions: AccountOption[] = useMemo(
        () =>
            [
                hasHDWallet && {
                    testID: 'add_account_add_button',
                    titleKey: 'onboarding.add_account.add_account_option_title',
                    descriptionKey:
                        'onboarding.add_account.add_account_option_description',
                    leftIcon: 'wallet-add' as IconName,
                    onPress: handleAddAccount,
                    isDisabled: isCreatingAccount,
                },
                {
                    testID: 'add_account_import_button',
                    titleKey:
                        'onboarding.add_account.import_account_option_title',
                    descriptionKey:
                        'onboarding.add_account.import_account_option_description',
                    leftIcon: 'fund' as IconName,
                    onPress: handleImportAccount,
                },
            ].filter(Boolean) as AccountOption[],
        [hasHDWallet, handleAddAccount, isCreatingAccount, handleImportAccount],
    )

    const otherOptions: AccountOption[] = useMemo(
        () => [
            {
                testID: 'add_account_watch_button',
                titleKey: 'onboarding.add_account.watch_address_option_title',
                descriptionKey:
                    'onboarding.add_account.watch_address_option_description',
                leftIcon: 'eye' as IconName,
                onPress: handleWatchAddress,
            },
            {
                testID: 'add_account_create_universal_wallet_button',
                titleKey:
                    'onboarding.add_account.create_universal_wallet_option_title',
                descriptionKey:
                    'onboarding.add_account.create_universal_wallet_option_description',
                leftIcon: 'wallet-with-algo' as IconName,
                onPress: handleCreateUniversalWallet,
                isDisabled: isCreatingAccount,
            },
            {
                testID: 'add_account_create_algo25_button',
                titleKey: 'onboarding.add_account.create_algo25_option_title',
                descriptionKey:
                    'onboarding.add_account.create_algo25_option_description',
                leftIcon: 'wallet' as IconName,
                onPress: handleCreateAlgo25,
                isDisabled: isCreatingAccount,
            },
        ],
        [
            handleWatchAddress,
            handleCreateUniversalWallet,
            handleCreateAlgo25,
            isCreatingAccount,
        ],
    )

    return {
        isCreatingAccount,
        isImportOptionsVisible,
        mainOptions,
        otherOptions,
        handleClose,
        handleImportAccount,
        handleCloseImportOptions,
        handleHDWalletPress,
        handleAlgo25Press,
        handleTermsPress,
        handlePrivacyPress,
        isOtherOptionsVisible,
        handleToggleOtherOptions,
    }
}

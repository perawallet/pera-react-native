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
    useHDWalletGroups,
} from '@perawallet/wallet-core-accounts'
import { useModalState } from '@hooks/useModalState'
import { useToast } from '@hooks/useToast'
import { useLanguage } from '@hooks/useLanguage'
import { deferToNextCycle } from '@perawallet/wallet-core-shared'
import { useWebView } from '@modules/webview'
import { config } from '@perawallet/wallet-core-config'
import { type IconName } from '@components/core'
import { useMultisigCreationStore } from '@modules/multisig/hooks/useMultisigCreation'
import { type AccountOption } from '@modules/onboarding/types'

export const useAddAccountScreen = () => {
    const navigation = useAppNavigation()
    const { createHdWalletAccount, createAlgo25WalletAccount } =
        useCreateAccount()
    const { createNextHDAccount, hasHDWallet } = useCreateNextHDAccount()
    const { hasMultipleHDWallets } = useHDWalletGroups()
    const { showToast } = useToast()
    const { t } = useLanguage()
    const { pushWebView } = useWebView()

    const {
        isOpen: isCreatingAccount,
        open: openCreatingAccount,
        close: closeCreatingAccount,
    } = useModalState()
    const {
        isOpen: isMultisigIntroductionVisible,
        open: openMultisigIntroduction,
        close: closeMultisigIntroduction,
    } = useModalState()

    const resetMultisigCreation = useMultisigCreationStore(
        state => state.resetState,
    )
    const [isOtherOptionsVisible, setIsOtherOptionsVisible] = useState(false)

    const handleAddAccount = useCallback(() => {
        if (!hasHDWallet) return

        if (hasMultipleHDWallets) {
            navigation.push('SelectHDWallet')
            return
        }

        openCreatingAccount()
        deferToNextCycle(async () => {
            try {
                const newAccount = await createNextHDAccount()
                if (newAccount) {
                    navigation.push('NameAccount', { account: newAccount })
                }
            } catch (error) {
                // guardrails-ignore-next-line no-error-toast-in-catch reason: localized create_account.error_message wraps the raw error; preserved verbatim
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
        hasMultipleHDWallets,
        createNextHDAccount,
        openCreatingAccount,
        closeCreatingAccount,
        navigation,
        showToast,
        t,
    ])

    const handleOpenImportAccountOptions = useCallback(
        () => navigation.push('ImportAccountOptions'),
        [navigation],
    )

    const handleTermsPress = useCallback(
        () =>
            pushWebView({
                url: config.termsOfServiceUrl,
                id: 'terms-of-service',
            }),
        [pushWebView],
    )
    const handlePrivacyPress = useCallback(
        () =>
            pushWebView({ url: config.privacyPolicyUrl, id: 'privacy-policy' }),
        [pushWebView],
    )
    const handleContinueMultisigIntroduction = useCallback(() => {
        closeMultisigIntroduction()
        resetMultisigCreation()
        navigation.navigate('Multisig', { screen: 'CreateMultisig' })
    }, [closeMultisigIntroduction, navigation, resetMultisigCreation])

    const handleWatchAddress = useCallback(
        () => navigation.push('WatchInfo'),
        [navigation],
    )

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
                // guardrails-ignore-next-line no-error-toast-in-catch reason: localized create_account.error_message wraps the raw error; preserved verbatim
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
                // guardrails-ignore-next-line no-error-toast-in-catch reason: localized create_account.error_message wraps the raw error; preserved verbatim
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
                !hasHDWallet && {
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
                    testID: 'add_account_create_multisig_button',
                    titleKey:
                        'onboarding.add_account.create_multisig_option_title',
                    descriptionKey:
                        'onboarding.add_account.create_multisig_option_description',
                    leftIcon: 'people' as IconName,
                    onPress: openMultisigIntroduction,
                },
                {
                    testID: 'add_account_import_button',
                    titleKey:
                        'onboarding.add_account.import_account_option_title',
                    descriptionKey:
                        'onboarding.add_account.import_account_option_description',
                    leftIcon: 'wallet-import' as IconName,
                    onPress: handleOpenImportAccountOptions,
                },
            ].filter(Boolean) as AccountOption[],
        [
            hasHDWallet,
            handleAddAccount,
            handleCreateUniversalWallet,
            isCreatingAccount,
            openMultisigIntroduction,
            handleOpenImportAccountOptions,
        ],
    )

    const otherOptions: AccountOption[] = useMemo(
        () =>
            [
                {
                    testID: 'add_account_watch_button',
                    titleKey:
                        'onboarding.add_account.watch_address_option_title',
                    descriptionKey:
                        'onboarding.add_account.watch_address_option_description',
                    leftIcon: 'eye' as IconName,
                    onPress: handleWatchAddress,
                },
                hasHDWallet && {
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
                    titleKey:
                        'onboarding.add_account.create_algo25_option_title',
                    descriptionKey:
                        'onboarding.add_account.create_algo25_option_description',
                    leftIcon: 'wallet' as IconName,
                    onPress: handleCreateAlgo25,
                    isDisabled: isCreatingAccount,
                },
            ].filter(Boolean) as AccountOption[],
        [
            hasHDWallet,
            handleWatchAddress,
            handleCreateUniversalWallet,
            handleCreateAlgo25,
            isCreatingAccount,
        ],
    )

    return {
        isCreatingAccount,
        mainOptions,
        otherOptions,
        handleClose: navigation.goBack,
        handleTermsPress,
        handlePrivacyPress,
        isMultisigIntroductionVisible,
        handleCloseMultisigIntroduction: closeMultisigIntroduction,
        handleContinueMultisigIntroduction,
        isOtherOptionsVisible,
        handleToggleOtherOptions: () => setIsOtherOptionsVisible(prev => !prev),
    }
}

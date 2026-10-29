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

import { useCallback, useMemo, useState } from 'react'
import {
    useCreateAccount,
    useCreateNextHDAccount,
} from '@perawallet/wallet-core-accounts'
import {
    LEGACY_CHAIN_ID,
    i18nKey,
    type I18nKey,
} from '@perawallet/wallet-core-chain-contract'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { useIsPeraCardEnabled } from '@hooks/useIsPeraCardEnabled'
import { useCapability } from '@hooks/useCapability'
import { useLanguage } from '@hooks/useLanguage'
import { useWebView, withLanguageParam } from '@modules/webview'
import { config, isDebug, isStaging } from '@perawallet/wallet-core-config'
import { useCardSession } from '@perawallet/wallet-core-card'
import { useSelectedScope } from '@perawallet/wallet-core-chain-shared'
import type { IconName } from '@components/core'
import { useWatchableChainIds } from '@modules/onboarding/hooks'
import { watchAccountCopyFor } from '@modules/onboarding/utils/watchAccountCopyFor'
import type { AccountOption } from '@modules/onboarding/types'
import { useRunCreateAccount } from '../../hooks/useRunCreateAccount'
import { useLocalKeyCreateOptions } from '../../hooks/useLocalKeyCreateOptions'

export type UseAddAccountScreenResult = {
    isCreatingAccount: boolean
    creatingTitleKey: I18nKey
    mainOptions: AccountOption[]
    otherOptions: AccountOption[]
    handleClose: () => void
    handleTermsPress: () => void
    handlePrivacyPress: () => void
    isOtherOptionsVisible: boolean
    handleToggleOtherOptions: () => void
}

export const useAddAccountScreen = (): UseAddAccountScreenResult => {
    const navigation = useAppNavigation()
    const scope = useSelectedScope(LEGACY_CHAIN_ID)
    const { buildHdWalletAccount } = useCreateAccount(scope)
    const { hasHDWallet } = useCreateNextHDAccount(scope)
    const { currentLanguage } = useLanguage()
    const { pushWebView } = useWebView()
    // TODO(card): TEMP — a completed Baanx onboarding persists `isAuthenticated`,
    // which hides this entry with no in-app way to clear it. Force it visible in
    // debug + staging builds so the sandbox flow stays re-testable; the signed
    // prod release keeps the real gating. Swap this session proxy for a real
    // hasCard check (useCardStatusQuery gated on isAuthenticated) once wired.
    const { isAuthenticated } = useCardSession()
    const hasCardSession = isDebug || isStaging ? false : isAuthenticated
    const isPeraCardEnabled = useIsPeraCardEnabled()
    const canAddWatchAccount = useCapability({ anyChain: 'watchAccounts' })
    const watchAccountCopy = watchAccountCopyFor(useWatchableChainIds())

    const { isCreatingAccount, creatingTitleKey, runCreateAccount } =
        useRunCreateAccount()
    const createOptions = useLocalKeyCreateOptions({
        chainId: scope.chainId,
        runCreateAccount,
        isCreatingAccount,
    })
    const [isOtherOptionsVisible, setIsOtherOptionsVisible] = useState(false)

    const handleOpenAddAccountOptions = useCallback(
        () => navigation.push('AddAccountOptions', { chainId: scope.chainId }),
        [navigation, scope.chainId],
    )

    const handleOpenImportAccountOptions = useCallback(
        () => navigation.push('ImportAccountOptions'),
        [navigation],
    )

    const handleAddPeraCard = useCallback(
        () => navigation.navigate('PeraCard', { screen: 'PeraCardIntro' }),
        [navigation],
    )

    const handleTermsPress = useCallback(
        () =>
            pushWebView({
                url: withLanguageParam(
                    config.termsOfServiceUrl,
                    currentLanguage,
                ),
                id: 'terms-of-service',
            }),
        [pushWebView, currentLanguage],
    )
    const handlePrivacyPress = useCallback(
        () =>
            pushWebView({
                url: withLanguageParam(
                    config.privacyPolicyUrl,
                    currentLanguage,
                ),
                id: 'privacy-policy',
            }),
        [pushWebView, currentLanguage],
    )

    const handleWatchAddress = useCallback(
        () => navigation.push('WatchInfo'),
        [navigation],
    )

    const handleCreateUniversalWallet = useCallback(() => {
        runCreateAccount(() =>
            buildHdWalletAccount({ account: 0, keyIndex: 0 }),
        )
    }, [buildHdWalletAccount, runCreateAccount])

    const mainOptions: AccountOption[] = useMemo(
        () =>
            (
                [
                    {
                        testID: 'add_account_add_button',
                        titleKey: i18nKey(
                            'onboarding.add_account.add_account_option_title',
                        ),
                        descriptionKey: hasHDWallet
                            ? i18nKey(
                                  'onboarding.add_account.add_account_option_description',
                              )
                            : i18nKey(
                                  'onboarding.add_account_options.multichain_new_wallet_description',
                              ),
                        leftIcon: 'wallet-add' as IconName,
                        onPress: handleOpenAddAccountOptions,
                        isDisabled: isCreatingAccount,
                    },
                    isPeraCardEnabled &&
                        !hasCardSession && {
                            testID: 'add_account_pera_card_button',
                            titleKey: i18nKey(
                                'onboarding.add_account.pera_card_option_title',
                            ),
                            descriptionKey: i18nKey(
                                'onboarding.add_account.pera_card_option_description',
                            ),
                            leftIcon: 'card' as IconName,
                            onPress: handleAddPeraCard,
                        },
                    {
                        testID: 'add_account_import_button',
                        titleKey: i18nKey(
                            'onboarding.add_account.import_account_option_title',
                        ),
                        descriptionKey: i18nKey(
                            'onboarding.add_account.import_account_option_description',
                        ),
                        leftIcon: 'wallet-import' as IconName,
                        onPress: handleOpenImportAccountOptions,
                    },
                ] satisfies (AccountOption | false)[]
            ).filter((option): option is AccountOption => !!option),
        [
            hasHDWallet,
            isCreatingAccount,
            handleOpenAddAccountOptions,
            isPeraCardEnabled,
            hasCardSession,
            handleAddPeraCard,
            handleOpenImportAccountOptions,
        ],
    )

    const otherOptions: AccountOption[] = useMemo(
        () =>
            (
                [
                    canAddWatchAccount && {
                        testID: 'add_account_watch_button',
                        titleKey: i18nKey(
                            'onboarding.add_account.watch_address_option_title',
                        ),
                        descriptionKey: watchAccountCopy.optionDescriptionKey,
                        leftIcon: 'eye' as IconName,
                        onPress: handleWatchAddress,
                    },
                    {
                        testID: 'add_account_create_universal_wallet_button',
                        titleKey: i18nKey(
                            'onboarding.add_account.create_universal_wallet_option_title',
                        ),
                        descriptionKey: i18nKey(
                            'onboarding.add_account.create_universal_wallet_option_description',
                        ),
                        leftIcon: 'wallet-with-algo' as IconName,
                        onPress: handleCreateUniversalWallet,
                        isDisabled: isCreatingAccount,
                    },
                    ...createOptions.other,
                ] satisfies (AccountOption | false)[]
            ).filter((option): option is AccountOption => !!option),
        [
            canAddWatchAccount,
            watchAccountCopy,
            handleWatchAddress,
            handleCreateUniversalWallet,
            createOptions,
            isCreatingAccount,
        ],
    )

    const handleToggleOtherOptions = useCallback(
        () => setIsOtherOptionsVisible(prev => !prev),
        [],
    )

    return {
        isCreatingAccount,
        creatingTitleKey,
        mainOptions,
        otherOptions,
        handleClose: navigation.goBack,
        handleTermsPress,
        handlePrivacyPress,
        isOtherOptionsVisible,
        handleToggleOtherOptions,
    }
}

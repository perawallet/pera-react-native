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
import { useAppNavigation } from '@hooks/useAppNavigation'
import { useIsMounted } from '@hooks/useIsMounted'
import { useIsPeraCardEnabled } from '@hooks/useIsPeraCardEnabled'
import { useIsQuantumAccountsEnabled } from '@hooks/useIsQuantumAccountsEnabled'
import { routeCapabilities } from '@routes/capabilities'
import {
    useCreateAccount,
    useCreateNextHDAccount,
    useHDWalletGroups,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { useModalState } from '@hooks/useModalState'
import { useErrorToast } from '@hooks/useErrorToast'
import { useLanguage } from '@hooks/useLanguage'
import { deferToNextCycle, type Nullable } from '@perawallet/wallet-core-shared'
import { useWebView } from '@modules/webview'
import { config, isDebug, isStaging } from '@perawallet/wallet-core-config'
import { useCardSession } from '@perawallet/wallet-core-card'
import { type IconName } from '@components/core'
import { useMultisigCreationStore } from '@modules/multisig/hooks/useMultisigCreation'
import { type AccountOption } from '@modules/onboarding/types'
import { trackEvent, OnboardingEvent } from '@analytics'

// Default loading-overlay title shown while an account is being created.
// Individual create flows (e.g. Quantum keygen) can override it per call.
const DEFAULT_CREATING_TITLE_KEY = 'onboarding.create_account.processing'

export const useAddAccountScreen = () => {
    const navigation = useAppNavigation()
    const isMounted = useIsMounted()
    const {
        buildHdWalletAccount,
        buildAlgo25WalletAccount,
        buildQuantumWalletAccount,
    } = useCreateAccount()
    const { buildNextHDAccount, hasHDWallet } = useCreateNextHDAccount()
    const { hasMultipleHDWallets } = useHDWalletGroups()
    const { showError } = useErrorToast()
    const { t } = useLanguage()
    const { pushWebView } = useWebView()
    // TODO(card): TEMP — a completed Baanx onboarding persists `isAuthenticated`,
    // which hides this entry with no in-app way to clear it. Force it visible in
    // debug + staging builds so the sandbox flow stays re-testable; the signed
    // prod release keeps the real gating. Swap this session proxy for a real
    // hasCard check (useCardStatusQuery gated on isAuthenticated) once wired.
    const { isAuthenticated } = useCardSession()
    const hasCardSession = isDebug || isStaging ? false : isAuthenticated
    const isPeraCardEnabled = useIsPeraCardEnabled()
    const isQuantumAccountsEnabled = useIsQuantumAccountsEnabled()

    const {
        isOpen: isCreatingAccount,
        open: openCreatingAccount,
        close: closeCreatingAccount,
    } = useModalState()
    const [creatingTitleKey, setCreatingTitleKey] = useState(
        DEFAULT_CREATING_TITLE_KEY,
    )
    const {
        isOpen: isMultisigIntroductionVisible,
        open: openMultisigIntroduction,
        close: closeMultisigIntroduction,
    } = useModalState()

    const resetMultisigCreation = useMultisigCreationStore(
        state => state.resetState,
    )
    const [isOtherOptionsVisible, setIsOtherOptionsVisible] = useState(false)

    // Shared create-account flow: open the creating-account state, create on the
    // next cycle, navigate to naming on success, toast on failure, always close.
    // `titleKey` overrides the loading-overlay title for flows that need their
    // own copy (e.g. the heavier Quantum keygen).
    const runCreateAccount = useCallback(
        (
            create: () => Promise<Nullable<WalletAccount>>,
            titleKey: string = DEFAULT_CREATING_TITLE_KEY,
        ) => {
            setCreatingTitleKey(titleKey)
            openCreatingAccount()
            void deferToNextCycle(async () => {
                try {
                    const newAccount = await create()
                    if (!isMounted()) return
                    if (newAccount) {
                        navigation.push('NameAccount', { account: newAccount })
                    }
                } catch (error) {
                    if (!isMounted()) return
                    showError(error, t('onboarding.create_account.error_title'))
                } finally {
                    if (isMounted()) closeCreatingAccount()
                }
            })
        },
        [
            isMounted,
            openCreatingAccount,
            closeCreatingAccount,
            navigation,
            showError,
            t,
        ],
    )

    const handleAddAccount = useCallback(() => {
        if (!hasHDWallet) return

        if (hasMultipleHDWallets) {
            navigation.push('SelectHDWallet')
            return
        }

        runCreateAccount(buildNextHDAccount)
    }, [
        hasHDWallet,
        hasMultipleHDWallets,
        navigation,
        buildNextHDAccount,
        runCreateAccount,
    ])

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
        runCreateAccount(() =>
            buildHdWalletAccount({ account: 0, keyIndex: 0 }),
        )
    }, [buildHdWalletAccount, runCreateAccount])

    const handleCreateAlgo25 = useCallback(() => {
        runCreateAccount(() => buildAlgo25WalletAccount({}))
    }, [buildAlgo25WalletAccount, runCreateAccount])

    const handleCreateQuantum = useCallback(() => {
        trackEvent(OnboardingEvent.CreateAccountQuantum)
        // Quantum keygen is heavier than Ed25519, so surface a Quantum-specific
        // progress title while it runs. Mirrors handleCreateAlgo25 otherwise:
        // build in memory, then NameAccount persists after the user names it.
        runCreateAccount(
            () => buildQuantumWalletAccount(),
            'onboarding.add_account.quantum_creating_title',
        )
    }, [buildQuantumWalletAccount, runCreateAccount])

    const handleLearnMoreQuantum = useCallback(
        () =>
            // TODO(PQ): point at the dedicated Quantum accounts support page
            // once it exists; accountTypeSupportUrl is the closest placeholder.
            pushWebView({
                url: config.accountTypeSupportUrl,
                id: 'quantum-account-support',
            }),
        [pushWebView],
    )

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
                isQuantumAccountsEnabled && {
                    testID: 'add_account_create_quantum_button',
                    titleKey:
                        'onboarding.add_account.quantum_account_option_title',
                    descriptionKey:
                        'onboarding.add_account.quantum_account_option_description',
                    leftIcon: 'quantum' as IconName,
                    onPress: handleCreateQuantum,
                    isDisabled: isCreatingAccount,
                    badge: {
                        labelKey:
                            'onboarding.add_account.quantum_account_option_badge',
                        variant: 'new',
                    },
                    learnMore: {
                        labelKey:
                            'onboarding.add_account.quantum_account_option_learn_more',
                        onPress: handleLearnMoreQuantum,
                    },
                },
                routeCapabilities.sharedAccounts && {
                    testID: 'add_account_create_multisig_button',
                    titleKey:
                        'onboarding.add_account.create_multisig_option_title',
                    descriptionKey:
                        'onboarding.add_account.create_multisig_option_description',
                    leftIcon: 'people' as IconName,
                    onPress: openMultisigIntroduction,
                },
                isPeraCardEnabled &&
                    !hasCardSession && {
                        testID: 'add_account_pera_card_button',
                        titleKey:
                            'onboarding.add_account.pera_card_option_title',
                        descriptionKey:
                            'onboarding.add_account.pera_card_option_description',
                        leftIcon: 'card' as IconName,
                        onPress: handleAddPeraCard,
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
            isQuantumAccountsEnabled,
            handleCreateQuantum,
            handleLearnMoreQuantum,
            isCreatingAccount,
            openMultisigIntroduction,
            hasCardSession,
            isPeraCardEnabled,
            handleAddPeraCard,
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
        creatingTitleKey,
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

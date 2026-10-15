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
    canImportRawKey,
    offeredLocalKeyKinds,
    useCreateAccount,
    useCreateNextHDAccount,
    useHdSeedGroups,
    type LocalKeyCreateOption,
    type LocalKeySeed,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import {
    isPostQuantumScheme,
    LEGACY_CHAIN_ID,
    i18nKey,
    type ChainId,
    type I18nKey,
} from '@perawallet/wallet-core-chain-contract'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { useIsMounted } from '@hooks/useIsMounted'
import { useIsPeraCardEnabled } from '@hooks/useIsPeraCardEnabled'
import { useCapability } from '@hooks/useCapability'
import { useModalState } from '@hooks/useModalState'
import { useErrorToast } from '@hooks/useErrorToast'
import { useLanguage } from '@hooks/useLanguage'
import { deferToNextCycle, type Nullable } from '@perawallet/wallet-core-shared'
import { useWebView, withLanguageParam } from '@modules/webview'
import { config, isDebug, isStaging } from '@perawallet/wallet-core-config'
import { useCardSession } from '@perawallet/wallet-core-card'
import { useSelectedScope } from '@perawallet/wallet-core-chain-shared'
import { getProvider } from '@perawallet/wallet-extension-provider'
import type { IconName } from '@components/core'
import { useMultisigCreationStore } from '@modules/multisig'
import { useDeriveChainAccount } from '@modules/onboarding/hooks'
import type {
    AccountOption,
    AddAccountChainOption,
} from '@modules/onboarding/types'
import { trackChainOnboardingEvent } from '../../utils'

// A key kind's create option can override it for its own keygen.
const DEFAULT_CREATING_TITLE_KEY = i18nKey(
    'onboarding.create_account.processing',
)

export const useAddAccountScreen = () => {
    const navigation = useAppNavigation()
    const isMounted = useIsMounted()
    const scope = useSelectedScope(LEGACY_CHAIN_ID)
    const { buildHdWalletAccount, buildSingleKeyAccount } =
        useCreateAccount(scope)
    const { buildNextHDAccount, hasHDWallet } = useCreateNextHDAccount(scope)
    const { hasMultipleHdSeeds } = useHdSeedGroups()
    const { showError } = useErrorToast()
    const { t, currentLanguage } = useLanguage()
    const { pushWebView } = useWebView()
    // TODO(card): TEMP — a completed Baanx onboarding persists `isAuthenticated`,
    // which hides this entry with no in-app way to clear it. Force it visible in
    // debug + staging builds so the sandbox flow stays re-testable; the signed
    // prod release keeps the real gating. Swap this session proxy for a real
    // hasCard check (useCardStatusQuery gated on isAuthenticated) once wired.
    const { isAuthenticated } = useCardSession()
    const hasCardSession = isDebug || isStaging ? false : isAuthenticated
    const isPeraCardEnabled = useIsPeraCardEnabled()
    const canUseMultisig = useCapability({
        platform: 'sharedAccounts',
        anyChain: 'multisig',
    })
    const canAddWatchAccount = useCapability({ anyChain: 'watchAccounts' })
    const isQuantumEnabled = useCapability({
        platform: 'quantum',
        anyChain: 'quantumAccounts',
    })

    const chainDescriptors = getProvider().chains.list()
    const hasChainStep = chainDescriptors.length > 1
    const [selectedChainId, setSelectedChainId] = useState<ChainId | undefined>(
        hasChainStep ? undefined : (chainDescriptors[0]?.id ?? LEGACY_CHAIN_ID),
    )
    const isChainStepVisible = hasChainStep && selectedChainId === undefined
    // Every hook below needs a chain, so the chain step reads the legacy one
    // until a row is picked; nothing it computes renders in the meantime.
    const optionsChainId = selectedChainId ?? LEGACY_CHAIN_ID
    const isLegacyChain = optionsChainId === LEGACY_CHAIN_ID
    const { derivableWallets, deriveChainAccount } =
        useDeriveChainAccount(optionsChainId)
    const canImportPrivateKey =
        useCapability({
            chain: { chainId: optionsChainId, capability: 'privateKeys' },
        }) && canImportRawKey(optionsChainId)
    const canWatchOnChain = useCapability({
        chain: { chainId: optionsChainId, capability: 'watchAccounts' },
    })

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

    const runCreateAccount = useCallback(
        (
            create: () => Promise<Nullable<WalletAccount>>,
            titleKey: I18nKey = DEFAULT_CREATING_TITLE_KEY,
            chainId?: ChainId,
        ) => {
            setCreatingTitleKey(titleKey)
            openCreatingAccount()
            void deferToNextCycle(async () => {
                try {
                    const newAccount = await create()
                    if (!isMounted()) return
                    if (newAccount) {
                        navigation.push('NameAccount', {
                            account: newAccount,
                            chainId,
                        })
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

        if (hasMultipleHdSeeds) {
            navigation.push('SelectHDWallet')
            return
        }

        runCreateAccount(buildNextHDAccount)
    }, [
        hasHDWallet,
        hasMultipleHdSeeds,
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

    // The account is built in memory; NameAccount persists it once named.
    const handleCreateKind = useCallback(
        (seed: LocalKeySeed, option: LocalKeyCreateOption) => {
            trackChainOnboardingEvent(option.analyticsEvent)
            runCreateAccount(
                () => buildSingleKeyAccount({ seed }),
                option.progressTitleKey,
            )
        },
        [buildSingleKeyAccount, runCreateAccount],
    )

    const handleDeriveFromWallet = useCallback(() => {
        if (derivableWallets.length > 1) {
            navigation.push('SelectHDWallet', { chainId: optionsChainId })
            return
        }
        const [wallet] = derivableWallets
        if (!wallet) return
        runCreateAccount(
            () => deriveChainAccount(wallet.seedKeyId),
            undefined,
            optionsChainId,
        )
    }, [
        derivableWallets,
        navigation,
        optionsChainId,
        runCreateAccount,
        deriveChainAccount,
    ])

    const handleImportPrivateKey = useCallback(
        () => navigation.push('ImportPrivateKey', { chainId: optionsChainId }),
        [navigation, optionsChainId],
    )

    const chainOptions: AddAccountChainOption[] = hasChainStep
        ? chainDescriptors.map(({ id, displayName }) => ({
              chainId: id,
              testID: `add_account_chain_${id}_button`,
              displayName,
              onPress: () => {
                  setIsOtherOptionsVisible(false)
                  setSelectedChainId(id)
              },
          }))
        : []

    const chainEntryOptions = useMemo(() => {
        const main: AccountOption[] = []
        const other: AccountOption[] = []
        if (isLegacyChain) return { main, other }
        if (derivableWallets.length > 0) {
            main.push({
                testID: 'add_account_derive_from_wallet_button',
                titleKey: i18nKey(
                    'onboarding.add_account.derive_from_wallet_option_title',
                ),
                descriptionKey: i18nKey(
                    'onboarding.add_account.derive_from_wallet_option_description',
                ),
                leftIcon: 'wallet-add',
                onPress: handleDeriveFromWallet,
                isDisabled: isCreatingAccount,
            })
        }
        if (canImportPrivateKey) {
            main.push({
                testID: 'add_account_import_private_key_button',
                titleKey: i18nKey(
                    'onboarding.add_account.import_private_key_option_title',
                ),
                descriptionKey: i18nKey(
                    'onboarding.add_account.import_private_key_option_description',
                ),
                leftIcon: 'key',
                onPress: handleImportPrivateKey,
            })
        }
        if (canWatchOnChain) {
            other.push({
                testID: 'add_account_watch_button',
                titleKey: i18nKey(
                    'onboarding.add_account.watch_address_option_title',
                ),
                descriptionKey: i18nKey(
                    'onboarding.add_account.watch_address_option_description',
                ),
                leftIcon: 'eye',
                onPress: handleWatchAddress,
            })
        }
        return { main, other }
    }, [
        isLegacyChain,
        derivableWallets.length,
        canImportPrivateKey,
        canWatchOnChain,
        isCreatingAccount,
        handleDeriveFromWallet,
        handleImportPrivateKey,
        handleWatchAddress,
    ])

    const createOptions = useMemo(() => {
        const featured: AccountOption[] = []
        const other: AccountOption[] = []
        for (const { kind, options } of offeredLocalKeyKinds(scope.chainId)) {
            const option = options.create
            if (!option) continue
            if (isPostQuantumScheme(kind.signingScheme) && !isQuantumEnabled) {
                continue
            }
            const { learnMore } = option
            const row: AccountOption = {
                testID: `add_account_create_${option.id}_button`,
                titleKey: option.titleKey,
                descriptionKey: option.descriptionKey,
                leftIcon: option.icon as IconName,
                onPress: () => handleCreateKind(kind.seed, option),
                isDisabled: isCreatingAccount,
                badge: option.badgeKey
                    ? { labelKey: option.badgeKey, variant: 'new' }
                    : undefined,
                learnMore: learnMore
                    ? {
                          labelKey: learnMore.labelKey,
                          onPress: () =>
                              pushWebView({
                                  url: learnMore.url,
                                  id: `${option.id}-account-support`,
                              }),
                      }
                    : undefined,
            }
            ;(option.isFeatured ? featured : other).push(row)
        }
        return { featured, other }
    }, [
        scope.chainId,
        isQuantumEnabled,
        isCreatingAccount,
        handleCreateKind,
        pushWebView,
    ])

    const legacyMainOptions: AccountOption[] = useMemo(
        () =>
            (
                [
                    hasHDWallet && {
                        testID: 'add_account_add_button',
                        titleKey: i18nKey(
                            'onboarding.add_account.add_account_option_title',
                        ),
                        descriptionKey: i18nKey(
                            'onboarding.add_account.add_account_option_description',
                        ),
                        leftIcon: 'wallet-add' as IconName,
                        onPress: handleAddAccount,
                        isDisabled: isCreatingAccount,
                    },
                    !hasHDWallet && {
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
                    ...createOptions.featured,
                    canUseMultisig && {
                        testID: 'add_account_create_multisig_button',
                        titleKey: i18nKey(
                            'onboarding.add_account.create_multisig_option_title',
                        ),
                        descriptionKey: i18nKey(
                            'onboarding.add_account.create_multisig_option_description',
                        ),
                        leftIcon: 'people' as IconName,
                        onPress: openMultisigIntroduction,
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
                ] satisfies (AccountOption | false | null | undefined)[]
            ).filter((option): option is AccountOption => !!option),
        [
            hasHDWallet,
            handleAddAccount,
            handleCreateUniversalWallet,
            createOptions,
            canUseMultisig,
            isCreatingAccount,
            openMultisigIntroduction,
            hasCardSession,
            isPeraCardEnabled,
            handleAddPeraCard,
            handleOpenImportAccountOptions,
        ],
    )

    const legacyOtherOptions: AccountOption[] = useMemo(
        () =>
            (
                [
                    canAddWatchAccount && {
                        testID: 'add_account_watch_button',
                        titleKey: i18nKey(
                            'onboarding.add_account.watch_address_option_title',
                        ),
                        descriptionKey: i18nKey(
                            'onboarding.add_account.watch_address_option_description',
                        ),
                        leftIcon: 'eye' as IconName,
                        onPress: handleWatchAddress,
                    },
                    hasHDWallet && {
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
                ] satisfies (AccountOption | false | null | undefined)[]
            ).filter((option): option is AccountOption => !!option),
        [
            hasHDWallet,
            canAddWatchAccount,
            handleWatchAddress,
            handleCreateUniversalWallet,
            createOptions,
            isCreatingAccount,
        ],
    )

    const mainOptions = isLegacyChain
        ? legacyMainOptions
        : chainEntryOptions.main
    const otherOptions = isLegacyChain
        ? legacyOtherOptions
        : chainEntryOptions.other

    const handleClose = useCallback(() => {
        if (hasChainStep && selectedChainId !== undefined) {
            setSelectedChainId(undefined)
            return
        }
        navigation.goBack()
    }, [hasChainStep, selectedChainId, navigation])

    return {
        isCreatingAccount,
        creatingTitleKey,
        isChainStepVisible,
        chainOptions,
        mainOptions,
        otherOptions,
        hasOtherOptions: isLegacyChain || otherOptions.length > 0,
        handleClose,
        handleTermsPress,
        handlePrivacyPress,
        isMultisigIntroductionVisible,
        handleCloseMultisigIntroduction: closeMultisigIntroduction,
        handleContinueMultisigIntroduction,
        isOtherOptionsVisible,
        handleToggleOtherOptions: () => setIsOtherOptionsVisible(prev => !prev),
    }
}

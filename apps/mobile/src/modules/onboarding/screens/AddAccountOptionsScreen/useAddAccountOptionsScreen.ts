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
import { type RouteProp, useRoute } from '@react-navigation/native'
import {
    useCreateAccount,
    useCreateNextHDAccount,
    useHdSeedGroups,
} from '@perawallet/wallet-core-accounts'
import { i18nKey, type I18nKey } from '@perawallet/wallet-core-chain-contract'
import { useSelectedScope } from '@perawallet/wallet-core-chain-shared'
import type { IconName } from '@components/core'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { useCapability } from '@hooks/useCapability'
import { useCapableChainId } from '@hooks/useCapableChainIds'
import { useModalState } from '@hooks/useModalState'
import { useMultisigCreationStore } from '@modules/multisig'
import type { AccountOption } from '@modules/onboarding/types'
import { useRunCreateAccount } from '../../hooks/useRunCreateAccount'
import { useLocalKeyCreateOptions } from '../../hooks/useLocalKeyCreateOptions'
import type { AddAccountStackParamList } from '../../routes/types'

export type UseAddAccountOptionsScreenResult = {
    options: AccountOption[]
    isCreatingAccount: boolean
    creatingTitleKey: I18nKey
    isMultisigIntroductionVisible: boolean
    handleCloseMultisigIntroduction: () => void
    handleContinueMultisigIntroduction: () => void
}

export const useAddAccountOptionsScreen =
    (): UseAddAccountOptionsScreenResult => {
        const navigation = useAppNavigation()
        const { chainId } =
            useRoute<RouteProp<AddAccountStackParamList, 'AddAccountOptions'>>()
                .params
        const scope = useSelectedScope(chainId)
        const { buildHdWalletAccount } = useCreateAccount(scope)
        const { buildNextHDAccount, hasHDWallet } =
            useCreateNextHDAccount(scope)
        const { hasMultipleHdSeeds } = useHdSeedGroups()
        const multisigChainId = useCapableChainId('multisig')
        const canUseMultisig = useCapability({
            platform: 'sharedAccounts',
            anyChain: 'multisig',
        })

        const { isCreatingAccount, creatingTitleKey, runCreateAccount } =
            useRunCreateAccount()
        const { featured } = useLocalKeyCreateOptions({
            chainId,
            runCreateAccount,
            isCreatingAccount,
        })
        const {
            isOpen: isMultisigIntroductionVisible,
            open: openMultisigIntroduction,
            close: closeMultisigIntroduction,
        } = useModalState()
        const resetMultisigCreation = useMultisigCreationStore(
            state => state.resetState,
        )

        // Without an HD wallet there is no seed to derive from, so the
        // multichain account starts a new Universal Wallet instead.
        const handleCreateMultichainAccount = useCallback(() => {
            if (!hasHDWallet) {
                runCreateAccount(() =>
                    buildHdWalletAccount({ account: 0, keyIndex: 0 }),
                )
                return
            }
            if (hasMultipleHdSeeds) {
                navigation.push('SelectHDWallet')
                return
            }
            runCreateAccount(buildNextHDAccount)
        }, [
            hasHDWallet,
            hasMultipleHdSeeds,
            navigation,
            buildHdWalletAccount,
            buildNextHDAccount,
            runCreateAccount,
        ])

        const handleContinueMultisigIntroduction = useCallback(() => {
            closeMultisigIntroduction()
            resetMultisigCreation()
            // The first multisig chain until a picker covers several.
            navigation.navigate('Multisig', {
                screen: 'CreateMultisig',
                params: { chainId: multisigChainId },
            })
        }, [
            closeMultisigIntroduction,
            navigation,
            resetMultisigCreation,
            multisigChainId,
        ])

        const options: AccountOption[] = useMemo(
            () =>
                (
                    [
                        {
                            testID: 'add_account_options_multichain_button',
                            titleKey: i18nKey(
                                'onboarding.add_account_options.multichain_title',
                            ),
                            descriptionKey: hasHDWallet
                                ? i18nKey(
                                      'onboarding.add_account_options.multichain_description',
                                  )
                                : i18nKey(
                                      'onboarding.add_account_options.multichain_new_wallet_description',
                                  ),
                            leftIcon: 'wallet-add' as IconName,
                            onPress: handleCreateMultichainAccount,
                            isDisabled: isCreatingAccount,
                        },
                        ...featured,
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
                    ] satisfies (AccountOption | false)[]
                ).filter((option): option is AccountOption => !!option),
            [
                hasHDWallet,
                handleCreateMultichainAccount,
                isCreatingAccount,
                featured,
                canUseMultisig,
                openMultisigIntroduction,
            ],
        )

        return {
            options,
            isCreatingAccount,
            creatingTitleKey,
            isMultisigIntroductionVisible,
            handleCloseMultisigIntroduction: closeMultisigIntroduction,
            handleContinueMultisigIntroduction,
        }
    }

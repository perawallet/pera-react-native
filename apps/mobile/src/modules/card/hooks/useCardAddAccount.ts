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

import { useCallback } from 'react'
import { StackActions } from '@react-navigation/native'
import {
    useCreateAccount,
    useCreateNextHDAccount,
    useHDWalletGroups,
} from '@perawallet/wallet-core-accounts'
import { logger } from '@perawallet/wallet-core-shared'
import { navigationRef } from '@routes/navigationRef'
import { useLanguage } from '@hooks/useLanguage'
import { useErrorToast } from '@hooks/useErrorToast'
import type { PostCreateReturnTarget } from '@modules/onboarding/routes/types'

// Push (not navigate) a fresh AddAccount stack, one frame out so the sheet
// teardown commits first. navigate('AddAccount') would jump back to an
// existing AddAccount below PeraCard and pop it off, breaking the returnTo to
// the checklist.
const navigateToAddAccount = (params: object) => {
    requestAnimationFrame(() => {
        navigationRef.dispatch(StackActions.push('AddAccount', params))
    })
}

// Returns to the card checklist after naming, and flags it to link the
// just-created (now globally selected) account as the funding source.
const CARD_SETUP_RETURN_TARGET: PostCreateReturnTarget = {
    name: 'PeraCard',
    params: {
        screen: 'CardOnboarding',
        params: {
            screen: 'CardOnboardingStatus',
            params: { autoConnectSelected: true },
        },
    },
}

export type UseCardAddAccountResult = {
    /**
     * Runs the app's standard add-account branch from the card flow: no HD
     * wallet → create a universal wallet; one HD wallet → build the next
     * account then name it directly; multiple HD wallets → pick which wallet
     * first. All paths cross into the root AddAccount stack and return to the
     * card setup checklist after the user names the account.
     */
    handleCreateAccount: () => void
}

export const useCardAddAccount = (): UseCardAddAccountResult => {
    const { t } = useLanguage()
    const { showError } = useErrorToast()
    const { buildHdWalletAccount } = useCreateAccount()
    const { buildNextHDAccount, hasHDWallet } = useCreateNextHDAccount()
    const { hasMultipleHDWallets } = useHDWalletGroups()

    const handleCreateAccount = useCallback(() => {
        const create = async () => {
            try {
                if (hasMultipleHDWallets) {
                    // Multiple wallets: let the user pick which one first.
                    navigateToAddAccount({
                        screen: 'SelectHDWallet',
                        params: { returnTo: CARD_SETUP_RETURN_TARGET },
                    })
                    return
                }
                // One HD wallet → next account; none → first universal account.
                const account = hasHDWallet
                    ? await buildNextHDAccount()
                    : await buildHdWalletAccount({ account: 0, keyIndex: 0 })
                if (!account) {
                    // Defensive: build couldn't resolve a seed — fall back to the picker.
                    logger.warn('[card] build returned null → SelectHDWallet')
                    navigateToAddAccount({
                        screen: 'SelectHDWallet',
                        params: { returnTo: CARD_SETUP_RETURN_TARGET },
                    })
                    return
                }
                navigateToAddAccount({
                    screen: 'NameAccount',
                    params: { account, returnTo: CARD_SETUP_RETURN_TARGET },
                })
            } catch (error) {
                logger.warn('[card] create account failed', {
                    error: `${error}`,
                })
                showError(error, t('onboarding.create_account.error_title'))
            }
        }
        void create()
    }, [
        hasMultipleHDWallets,
        hasHDWallet,
        buildNextHDAccount,
        buildHdWalletAccount,
        showError,
        t,
    ])

    return { handleCreateAccount }
}

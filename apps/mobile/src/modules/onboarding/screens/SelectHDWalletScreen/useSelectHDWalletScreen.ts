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
import { useLanguage } from '@hooks/useLanguage'
import { useToast } from '@hooks/useToast'
import {
    useHDWalletGroups,
    useCreateAccount,
    useAccountBalancesQuery,
    type HDWalletGroup,
    type AccountBalances,
} from '@perawallet/wallet-core-accounts'
import { deferToNextCycle } from '@perawallet/wallet-core-shared'

type UseSelectHDWalletScreenResult = {
    hdWalletGroups: HDWalletGroup[]
    accountBalances: AccountBalances
    isCreatingWallet: boolean
    handleSelectWallet: (group: HDWalletGroup) => void
    handleCreateNewWallet: () => void
    handleGoBack: () => void
    t: (key: string, options?: Record<string, unknown>) => string
}

export const useSelectHDWalletScreen = (): UseSelectHDWalletScreenResult => {
    const navigation = useAppNavigation()
    const { t } = useLanguage()
    const { showToast } = useToast()
    const { hdWalletGroups } = useHDWalletGroups()
    const { buildHdWalletAccount } = useCreateAccount()
    const [isCreatingWallet, setIsCreatingWallet] = useState(false)

    const allGroupAccounts = useMemo(
        () => hdWalletGroups.flatMap(g => g.accounts),
        [hdWalletGroups],
    )

    const { accountBalances } = useAccountBalancesQuery(allGroupAccounts, true)

    const handleSelectWallet = useCallback(
        async (group: HDWalletGroup) => {
            // Group is keyed by the bip39 seed id; siblings are the
            // accounts already grouped under it. Compute the next free
            // keyIndex on account 0 from the group itself rather than
            // re-filtering allAccounts (no need — the group already did).
            const nextKeyIndex =
                group.accounts.length > 0
                    ? Math.max(
                          ...group.accounts.map(
                              a => a.hdWalletDetails.keyIndex,
                          ),
                      ) + 1
                    : 0
            const newAccount = await buildHdWalletAccount({
                walletId: group.seedKeyId,
                account: 0,
                keyIndex: nextKeyIndex,
            })
            navigation.replace('NameAccount', { account: newAccount })
        },
        [buildHdWalletAccount, navigation],
    )

    const handleCreateNewWallet = useCallback(() => {
        setIsCreatingWallet(true)
        void deferToNextCycle(async () => {
            try {
                const newAccount = await buildHdWalletAccount({
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
                setIsCreatingWallet(false)
            }
        })
    }, [buildHdWalletAccount, navigation, showToast, t])

    const handleGoBack = useCallback(() => {
        navigation.goBack()
    }, [navigation])

    return {
        hdWalletGroups,
        accountBalances,
        isCreatingWallet,
        handleSelectWallet: (group: HDWalletGroup) =>
            void handleSelectWallet(group),
        handleCreateNewWallet,
        handleGoBack,
        t,
    }
}

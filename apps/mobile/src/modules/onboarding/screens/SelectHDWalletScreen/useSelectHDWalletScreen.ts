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
    const { createHdWalletAccount } = useCreateAccount()
    const [isCreatingWallet, setIsCreatingWallet] = useState(false)

    const allGroupAccounts = useMemo(
        () => hdWalletGroups.flatMap(g => g.accounts),
        [hdWalletGroups],
    )

    const { accountBalances } = useAccountBalancesQuery(allGroupAccounts, true)

    const handleSelectWallet = useCallback(
        (group: HDWalletGroup) => {
            navigation.push('SearchAccounts', {
                account: group.firstAccount,
            })
        },
        [navigation],
    )

    const handleCreateNewWallet = useCallback(() => {
        setIsCreatingWallet(true)
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
                setIsCreatingWallet(false)
            }
        })
    }, [createHdWalletAccount, navigation, showToast, t])

    const handleGoBack = useCallback(() => {
        navigation.goBack()
    }, [navigation])

    return {
        hdWalletGroups,
        accountBalances,
        isCreatingWallet,
        handleSelectWallet,
        handleCreateNewWallet,
        handleGoBack,
        t,
    }
}

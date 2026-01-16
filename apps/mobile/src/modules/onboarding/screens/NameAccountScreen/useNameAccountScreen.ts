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

import { useState } from 'react'
import {
    useAllAccounts,
    getAccountDisplayName,
    WalletAccount,
    useUpdateAccount,
    useCreateAccount,
} from '@perawallet/wallet-core-accounts'
import { useLanguage } from '@hooks/useLanguage'
import { useToast } from '@hooks/useToast'
import { usePreferences } from '@perawallet/wallet-core-settings'
import { UserPreferences } from '@constants/user-preferences'
import { useRoute, RouteProp } from '@react-navigation/native'
import { OnboardingStackParamList } from '../../routes'

type NameAccountScreenRouteProp = RouteProp<
    OnboardingStackParamList,
    'NameAccount'
>

export const useNameAccountScreen = () => {
    const route = useRoute<NameAccountScreenRouteProp>()

    const accounts = useAllAccounts()
    const updateAccount = useUpdateAccount()
    const createAccount = useCreateAccount()
    const { t } = useLanguage()
    const { showToast } = useToast()
    const { setPreference, deletePreference } = usePreferences()

    const routeAccount = route.params?.account

    const [account] = useState<WalletAccount | undefined>(routeAccount)
    const numWallets = accounts.length

    const initialWalletName = account
        ? getAccountDisplayName(account)
        : t('onboarding.name_account.wallet_label', { count: numWallets + 1 })

    const [walletDisplay, setWalletDisplay] =
        useState<string>(initialWalletName)
    const [isCreating, setIsCreating] = useState(false)

    const handleNameChange = (value: string) => {
        setWalletDisplay(value)
    }

    const handleFinish = async () => {
        if (isCreating) return

        try {
            setIsCreating(true)

            const targetAccount: WalletAccount =
                account || (await createAccount({ account: 0, keyIndex: 0 }))

            targetAccount.name = walletDisplay
            updateAccount(targetAccount)

            // Set confetti preference before triggering navigation
            // AccountScreen will read this preference and play the animation
            setPreference(UserPreferences.shouldPlayConfetti, true)

            // Deleting isCreatingAccount triggers automatic navigation:
            // 1. useShowOnboarding() returns false (no longer creating + has accounts)
            // 2. React Navigation unmounts Onboarding stack, mounts TabBar
            // 3. AccountScreen renders and plays confetti from preference
            deletePreference(UserPreferences.isCreatingAccount)
        } catch (error) {
            showToast({
                title: t('onboarding.create_account.error_title'),
                body: t('onboarding.create_account.error_message', {
                    error: `${error}`,
                }),
                type: 'error',
            })
        } finally {
            setIsCreating(false)
        }
    }

    return {
        walletDisplay,
        isCreating,
        handleNameChange,
        handleFinish,
        numWallets,
    }
}

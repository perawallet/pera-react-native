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

import { useState, useMemo } from 'react'
import {
    useAllAccounts,
    getAccountDisplayName,
    WalletAccount,
    useUpdateAccount,
    useCreateAccount,
    useSelectedAccountAddress,
    isHDWalletAccount,
} from '@perawallet/wallet-core-accounts'
import { useKMS } from '@perawallet/wallet-core-kms'
import { useLanguage } from '@hooks/useLanguage'
import { useToast } from '@hooks/useToast'
import { useRoute, RouteProp } from '@react-navigation/native'
import { OnboardingStackParamList } from '../../routes'
import {
    useShouldPlayConfetti,
    useExitAccountFlow,
} from '@modules/onboarding/hooks'
import { Optional } from '@perawallet/wallet-core-shared'

type NameAccountScreenRouteProp = RouteProp<
    OnboardingStackParamList,
    'NameAccount'
>

export const useNameAccountScreen = () => {
    const route = useRoute<NameAccountScreenRouteProp>()

    const accounts = useAllAccounts()
    const updateAccount = useUpdateAccount()
    const { createHdWalletAccount } = useCreateAccount()
    const { setSelectedAccountAddress } = useSelectedAccountAddress()
    const { t } = useLanguage()
    const { showToast } = useToast()
    const { setShouldPlayConfetti } = useShouldPlayConfetti()
    const { exitAccountFlow } = useExitAccountFlow()
    const { seedIdOf } = useKMS()

    const routeAccount = route.params?.account

    const [account] = useState<Optional<WalletAccount>>(routeAccount)

    const numWallets = useMemo(() => {
        // TODO: making sure this is ordered might be important. Come back at this once integrating multiple wallets.
        // HD accounts now reference their derived child via `keyPairId`;
        // collapse siblings into one wallet by walking up to the seed.
        const hdSeedIds = new Set<string>()
        let otherAccountsCount = 0

        accounts.forEach(acc => {
            if (isHDWalletAccount(acc)) {
                const seedId = seedIdOf(acc.keyPairId)
                if (seedId) hdSeedIds.add(seedId)
            } else {
                otherAccountsCount++
            }
        })

        // TODO: otherAccountsCount might not be necessary here. Come back at this once integrating multiple wallets.
        return hdSeedIds.size + otherAccountsCount
    }, [accounts, seedIdOf])

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

            // Wait for the next frame to ensure UI updates (overlay appears) before heavy work
            await new Promise(resolve => requestAnimationFrame(resolve))

            const targetAccount: WalletAccount =
                account ||
                (await createHdWalletAccount({ account: 0, keyIndex: 0 }))

            targetAccount.name = walletDisplay
            updateAccount(targetAccount)

            // Explicitly select the new account to ensure it's ready for AccountScreen
            // This triggers navigation via useShowOnboarding(), which waits for selection
            setSelectedAccountAddress(targetAccount.address)

            // Set confetti state - AccountScreen will read this and play the animation
            setShouldPlayConfetti(true)

            exitAccountFlow()
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
            setIsCreating(false)
        }
    }

    return {
        walletDisplay,
        isCreating,
        handleNameChange,
        handleFinish,
        numWallets,
        account,
    }
}

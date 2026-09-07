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

import { useEffect, useRef, useState, useMemo } from 'react'
import {
    useAllAccounts,
    getAccountDisplayName,
    type WalletAccount,
    useCreateAccount,
    useSelectedAccountAddress,
    isHDWalletAccount,
    useUpdateAccount,
    useAccountsStore,
    consumePendingAccountRollback,
    clearPendingAccountRollback,
} from '@perawallet/wallet-core-accounts'
import { useKMS } from '@perawallet/wallet-core-kms'
import { trackEvent, OnboardingEvent, AnalyticsMetadataKey } from '@analytics'
import { useLanguage } from '@hooks/useLanguage'
import { useErrorToast } from '@hooks/useErrorToast'
import { useRoute, type RouteProp } from '@react-navigation/native'
import type { OnboardingStackParamList } from '../../routes'
import {
    useShouldPlayConfetti,
    useExitAccountFlow,
} from '@modules/onboarding/hooks'
import type { Optional } from '@perawallet/wallet-core-shared'

type NameAccountScreenRouteProp = RouteProp<
    OnboardingStackParamList,
    'NameAccount'
>

export const useNameAccountScreen = () => {
    const route = useRoute<NameAccountScreenRouteProp>()

    const accounts = useAllAccounts()
    const updateAccount = useUpdateAccount()
    const { buildHdWalletAccount, saveAccount } = useCreateAccount()
    const { setSelectedAccountAddress } = useSelectedAccountAddress()
    const { t } = useLanguage()
    const { showError } = useErrorToast()
    const { setShouldPlayConfetti } = useShouldPlayConfetti()
    const { exitAccountFlow } = useExitAccountFlow()
    const { seedIdOf } = useKMS()

    const routeAccount = route.params?.account
    const didFinishRef = useRef(false)
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

    useEffect(() => {
        return () => {
            if (didFinishRef.current) {
                clearPendingAccountRollback()
            } else {
                void consumePendingAccountRollback()
            }
        }
    }, [])

    const handleFinish = async () => {
        if (isCreating) return

        trackEvent(OnboardingEvent.NameAccount)
        try {
            setIsCreating(true)

            // Wait for the next frame to ensure UI updates (overlay appears) before heavy work
            await new Promise(resolve => requestAnimationFrame(resolve))

            const targetAccount: WalletAccount =
                account ||
                (await buildHdWalletAccount({ account: 0, keyIndex: 0 }))

            const namedAccount = { ...targetAccount, name: walletDisplay }
            const isAlreadyInStore = useAccountsStore
                .getState()
                .accounts.some(a => a.address === targetAccount.address)

            if (isAlreadyInStore) {
                updateAccount(namedAccount)
            } else {
                await saveAccount(namedAccount)
            }

            trackEvent(OnboardingEvent.RegisterAccount, {
                [AnalyticsMetadataKey.AccountCreationType]:
                    targetAccount.type === 'hardware'
                        ? 'ledger'
                        : targetAccount.type === 'watch'
                          ? 'watch'
                          : 'create',
            })

            // Explicitly select the new account to ensure it's ready for AccountScreen
            // This triggers navigation via useShowOnboarding(), which waits for selection
            setSelectedAccountAddress(targetAccount.address)

            // Set confetti state - AccountScreen will read this and play the animation
            setShouldPlayConfetti(true)

            didFinishRef.current = true
            // Resume the caller's flow if one asked to be returned to (e.g. the
            // Pera Card Connect Funds picker); otherwise exit to Home as usual.
            exitAccountFlow(route.params?.returnTo)
        } catch (error) {
            showError(error, t('onboarding.create_account.error_title'))
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

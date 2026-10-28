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
    clearPendingAccountRollback,
    consumePendingAccountRollback,
    chainAccountOf,
    findAccountByAddressOn,
    preferDefaultChain,
    hdIndexOf,
    isHardwareWalletAccount,
    isWatchAccount,
    signingKeyOn,
    useAccountsStore,
    useAllAccounts,
    useCreateAccount,
    useRegisteredChainIds,
    useSelectedAccountId,
    useUpdateAccount,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { useKMS } from '@perawallet/wallet-core-kms'
import { trackEvent, OnboardingEvent, AnalyticsMetadataKey } from '@analytics'
import { useLanguage } from '@hooks/useLanguage'
import { useAccountName } from '@hooks/useAccountName'
import { useErrorToast } from '@hooks/useErrorToast'
import { useRoute, type RouteProp } from '@react-navigation/native'
import type { OnboardingStackParamList } from '../../routes'
import {
    useShouldPlayConfetti,
    useExitAccountFlow,
} from '@modules/onboarding/hooks'
import type { Optional } from '@perawallet/wallet-core-shared'
import {
    LEGACY_CHAIN_ID,
    type ChainId,
} from '@perawallet/wallet-core-chain-contract'
import { useSelectedScope } from '@perawallet/wallet-core-chain-shared'

type NameAccountScreenRouteProp = RouteProp<
    OnboardingStackParamList,
    'NameAccount'
>

export const useNameAccountScreen = () => {
    const route = useRoute<NameAccountScreenRouteProp>()

    const accounts = useAllAccounts()
    const updateAccount = useUpdateAccount()
    const scope = useSelectedScope(LEGACY_CHAIN_ID)
    const { buildHdWalletAccount, saveAccount } = useCreateAccount(scope)
    const { setSelectedAccountId } = useSelectedAccountId()
    const { t } = useLanguage()
    const { getAccountName } = useAccountName()
    const { showError } = useErrorToast()
    const { setShouldPlayConfetti } = useShouldPlayConfetti()
    const { exitAccountFlow } = useExitAccountFlow()
    const { seedIdOf } = useKMS()

    const routeAccount = route.params?.account
    const requestedChainId = route.params?.chainId ?? LEGACY_CHAIN_ID
    // Discovery can leave the chain an import was made on off the account.
    const chainId =
        routeAccount && !chainAccountOf(routeAccount, requestedChainId)
            ? (preferDefaultChain(
                  Object.keys(routeAccount.chains) as ChainId[],
              ) ?? requestedChainId)
            : requestedChainId
    const didFinishRef = useRef(false)
    const [account] = useState<Optional<WalletAccount>>(routeAccount)
    const registeredChainIds = useRegisteredChainIds()

    // The stored record, once there is one: discovery can add chains to it
    // after the route param was made.
    const storedAccount = account
        ? accounts.find(a => a.id === account.id)
        : undefined
    const enabledChainIds = useMemo((): ChainId[] => {
        const shown = storedAccount ?? account
        if (!shown || registeredChainIds.length < 2) return []
        return registeredChainIds.filter(chainId =>
            chainAccountOf(shown, chainId),
        )
    }, [storedAccount, account, registeredChainIds])

    const numWallets = useMemo(() => {
        // TODO: making sure this is ordered might be important. Come back at this once integrating multiple wallets.
        // HD accounts now reference their derived child via `keyPairId`;
        // collapse siblings into one wallet by walking up to the seed.
        const hdSeedIds = new Set<string>()
        let otherAccountsCount = 0

        accounts.forEach(acc => {
            if (hdIndexOf(acc) !== undefined) {
                const seedId = seedIdOf(signingKeyOn(acc, scope.chainId))
                if (seedId) hdSeedIds.add(seedId)
            } else {
                otherAccountsCount++
            }
        })

        // TODO: otherAccountsCount might not be necessary here. Come back at this once integrating multiple wallets.
        return hdSeedIds.size + otherAccountsCount
    }, [accounts, seedIdOf, scope.chainId])

    const accountTitle = account
        ? getAccountName(account, chainId)
        : t('onboarding.name_account.wallet_label', { count: numWallets + 1 })

    const [walletDisplay, setWalletDisplay] = useState<string>(accountTitle)
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

        trackEvent(OnboardingEvent.NameAccount, {
            [AnalyticsMetadataKey.ChainId]: chainId,
        })
        try {
            setIsCreating(true)

            // Wait for the next frame to ensure UI updates (overlay appears) before heavy work
            await new Promise(resolve => requestAnimationFrame(resolve))

            const targetAccount: WalletAccount =
                account ||
                (await buildHdWalletAccount({ account: 0, keyIndex: 0 }))

            const storedAccounts = useAccountsStore.getState().accounts
            const targetAddress = chainAccountOf(
                targetAccount,
                chainId,
            )?.address
            // Watched, derived and imported accounts are persisted before
            // naming, so naming renames the stored record: the route copy can
            // lack chains enabled since it was made.
            const stored =
                storedAccounts.find(a => a.id === targetAccount.id) ??
                (targetAddress !== undefined
                    ? findAccountByAddressOn(
                          storedAccounts,
                          chainId,
                          targetAddress,
                      )
                    : undefined)

            if (stored) {
                updateAccount({ ...stored, name: walletDisplay })
            } else {
                await saveAccount({ ...targetAccount, name: walletDisplay })
            }

            trackEvent(OnboardingEvent.RegisterAccount, {
                [AnalyticsMetadataKey.AccountCreationType]:
                    isHardwareWalletAccount(targetAccount)
                        ? 'ledger'
                        : isWatchAccount(targetAccount)
                          ? 'watch'
                          : 'create',
                [AnalyticsMetadataKey.ChainId]: chainId,
            })

            // Explicitly select the new account to ensure it's ready for AccountScreen
            // This triggers navigation via useShowOnboarding(), which waits for selection
            setSelectedAccountId(stored?.id ?? targetAccount.id)

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
        accountTitle,
        account,
        chainId,
        enabledChainIds,
    }
}

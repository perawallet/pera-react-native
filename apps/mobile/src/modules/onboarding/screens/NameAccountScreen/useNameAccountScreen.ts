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
    accountNumberOf,
    clearPendingAccountRollback,
    consumePendingAccountRollback,
    chainAccountOf,
    findAccountByAddressOn,
    getAccountDisplayName,
    preferDefaultChain,
    hdIndexOf,
    isHardwareWalletAccount,
    isWatchAccount,
    signingKeyOn,
    getAllAccounts,
    useAllAccounts,
    useCreateAccount,
    useSelectedAccountId,
    useUpdateAccount,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { useKMS } from '@perawallet/wallet-core-kms'
import { trackEvent, OnboardingEvent, AnalyticsMetadataKey } from '@analytics'
import { useLanguage } from '@hooks/useLanguage'
import { useAccountName } from '@hooks/useAccountName'
import {
    normalizeAccountName,
    useUniqueAccountName,
} from '@hooks/useUniqueAccountName'
import { useErrorToast } from '@hooks/useErrorToast'
import { useRoute, type RouteProp } from '@react-navigation/native'
import type { OnboardingStackParamList } from '../../routes'
import {
    useShouldPlayConfetti,
    useExitAccountFlow,
} from '@modules/onboarding/hooks'
import { useHomeChainScope } from '@hooks/useHomeChainScope'
import type { Optional } from '@perawallet/wallet-core-shared'
import { type ChainId } from '@perawallet/wallet-core-chain-contract'
import { useSelectedScope } from '@perawallet/wallet-core-chain-shared'

type NameAccountScreenRouteProp = RouteProp<
    OnboardingStackParamList,
    'NameAccount'
>

const accountCreationTypeOf = (
    account: WalletAccount,
): 'ledger' | 'watch' | 'create' => {
    if (isHardwareWalletAccount(account)) return 'ledger'
    return isWatchAccount(account) ? 'watch' : 'create'
}

// Watched, derived and imported accounts are persisted before naming, so the
// route copy can lack chains enabled since it was made: match by id, then by
// the address on `chainId`.
const storedRecordOf = (
    accounts: readonly WalletAccount[],
    account: WalletAccount,
    chainId: ChainId,
): Optional<WalletAccount> => {
    const byId = accounts.find(a => a.id === account.id)
    if (byId) return byId
    const address = chainAccountOf(account, chainId)?.address
    return address === undefined
        ? undefined
        : findAccountByAddressOn(accounts, chainId, address)
}

export const useNameAccountScreen = () => {
    const route = useRoute<NameAccountScreenRouteProp>()

    const accounts = useAllAccounts()
    const updateAccount = useUpdateAccount()
    const home = useHomeChainScope()
    const { setSelectedAccountId } = useSelectedAccountId()
    const { t } = useLanguage()
    const { getAccountName } = useAccountName()
    const { isAccountNameTaken, nextFreeAccountName } = useUniqueAccountName()
    const { showError } = useErrorToast()
    const { setShouldPlayConfetti } = useShouldPlayConfetti()
    const { exitAccountFlow } = useExitAccountFlow()
    const { seedIdOf } = useKMS()

    const routeAccount = route.params?.account
    const requestedChainId = route.params?.chainId ?? home.chainId
    // Discovery can leave the chain an import was made on off the account.
    const chainId =
        routeAccount && !chainAccountOf(routeAccount, requestedChainId)
            ? (preferDefaultChain(
                  Object.keys(routeAccount.chains) as ChainId[],
              ) ?? requestedChainId)
            : requestedChainId
    const scope = useSelectedScope(chainId)
    const { buildHdWalletAccount, saveAccount } = useCreateAccount(scope)
    const didFinishRef = useRef(false)
    const [account] = useState<Optional<WalletAccount>>(routeAccount)

    // The stored record, once there is one: discovery can add chains to it
    // after the route param was made.
    const storedAccount = account
        ? storedRecordOf(accounts, account, chainId)
        : undefined
    const ownRecordId = storedAccount?.id ?? account?.id
    // A name the stored record already has isn't a new collision: accounts
    // that share a name before naming are left as they are.
    const ownStoredName = normalizeAccountName(storedAccount?.name ?? '')
    const isTakenByAnother = (name: string) =>
        normalizeAccountName(name) !== ownStoredName &&
        isAccountNameTaken(name, ownRecordId)

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

    const baseTitle = account
        ? getAccountName(account, chainId)
        : t('onboarding.name_account.wallet_label', { count: numWallets + 1 })
    const accountTitle = isTakenByAnother(baseTitle)
        ? nextFreeAccountName(
              account ? (accountNumberOf(account) ?? 1) : 1,
              ownRecordId,
          )
        : baseTitle
    // A generated "Account #N" is left unstored, so it follows the language
    // and isn't backed up as a name the user chose. A bumped number can't be
    // rebuilt from the account, so it is stored like a typed name.
    const generatedTitle =
        account &&
        accountTitle === baseTitle &&
        baseTitle !== getAccountDisplayName(account, chainId)
            ? baseTitle
            : undefined

    const [walletDisplay, setWalletDisplay] = useState<string>(accountTitle)
    const [isCreating, setIsCreating] = useState(false)

    const trimmedName = walletDisplay.trim()
    const previewName = trimmedName || accountTitle
    const isNameTaken = isTakenByAnother(trimmedName)
    const nameError = isNameTaken ? t('account_info.name_taken') : undefined
    const isFinishDisabled = isCreating || trimmedName === '' || isNameTaken

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
        if (isFinishDisabled) return

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

            const stored = storedRecordOf(
                getAllAccounts(),
                targetAccount,
                chainId,
            )

            const name =
                trimmedName === generatedTitle ? undefined : trimmedName
            if (stored) {
                updateAccount({ ...stored, name })
            } else {
                await saveAccount({ ...targetAccount, name })
            }

            trackEvent(OnboardingEvent.RegisterAccount, {
                [AnalyticsMetadataKey.AccountCreationType]:
                    accountCreationTypeOf(targetAccount),
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
        previewName,
        account,
        chainId,
        nameError,
        isFinishDisabled,
    }
}

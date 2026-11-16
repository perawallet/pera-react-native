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

import { useEffect, useMemo, useRef, useState } from 'react'
import {
    accountChainOptions,
    accountNameKindOf,
    clearPendingAccountRollback,
    consumePendingAccountRollback,
    chainAccountOf,
    findAccountByAddressOn,
    isUnnamed,
    nextAccountName,
    preferDefaultChain,
    isHardwareWalletAccount,
    isWatchAccount,
    getAllAccounts,
    hdIndexOf,
    useAllAccounts,
    useCreateAccount,
    useDisableChains,
    useEnableChain,
    useSelectedAccountId,
    useUpdateAccount,
    withSelectedChains,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { trackEvent, OnboardingEvent, AnalyticsMetadataKey } from '@analytics'
import { useLanguage } from '@hooks/useLanguage'
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
import { useBottomSheet } from '@modules/bottom-sheet'
import { displayChainOption } from '@utils/chainOptionDisplay'
import type { Optional } from '@perawallet/wallet-core-shared'
import { type ChainId } from '@perawallet/wallet-core-chain-contract'
import { useSelectedScope } from '@perawallet/wallet-core-chain-shared'
import {
    ChooseNetworksContent,
    type ChooseNetworkRow,
} from './ChooseNetworksContent'

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

// Chains discovery found activity on: an imported account keeps these.
const activeChainsOf = (account: WalletAccount): ChainId[] =>
    (Object.keys(account.chains) as ChainId[]).filter(
        id => chainAccountOf(account, id)?.enabledBy === 'discovery',
    )

export const useNameAccountScreen = () => {
    const route = useRoute<NameAccountScreenRouteProp>()

    const accounts = useAllAccounts()
    const updateAccount = useUpdateAccount()
    const enableChain = useEnableChain()
    const disableChains = useDisableChains()
    const { request } = useBottomSheet()
    const home = useHomeChainScope()
    const { setSelectedAccountId } = useSelectedAccountId()
    const { t } = useLanguage()
    const { isAccountNameTaken } = useUniqueAccountName()
    const { showError } = useErrorToast()
    const { setShouldPlayConfetti } = useShouldPlayConfetti()
    const { exitAccountFlow } = useExitAccountFlow()

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

    // An account not stored yet can be unnamed; offer the name the store would give it.
    const named = storedAccount ?? account
    const suggestedName = nextAccountName(
        accounts,
        named ? accountNameKindOf(named) : 'account',
    )
    const baseTitle = named && !isUnnamed(named) ? named.name : suggestedName
    const accountTitle = isTakenByAnother(baseTitle) ? suggestedName : baseTitle

    // Offered only for an HD account, the one kind that spans chain families.
    const networkRows = useMemo(
        (): ChooseNetworkRow[] =>
            named && hdIndexOf(named)
                ? accountChainOptions(named, () => true, 'all').map(option => {
                      const { chainId, displayName, address } =
                          displayChainOption(option)
                      return { chainId, displayName, address }
                  })
                : [],
        [named],
    )
    const isChoosingNetworks = networkRows.length > 1
    const requiredChainIds = useMemo(
        () => (storedAccount ? activeChainsOf(storedAccount) : []),
        [storedAccount],
    )
    const [chosenChainIds, setChosenChainIds] = useState<Optional<ChainId[]>>()
    const selectedChainIds = useMemo(() => {
        const chosen =
            chosenChainIds ?? (Object.keys(named?.chains ?? {}) as ChainId[])
        return networkRows
            .map(row => row.chainId)
            .filter(id => requiredChainIds.includes(id) || chosen.includes(id))
    }, [chosenChainIds, named, networkRows, requiredChainIds])

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

    const handleEditNetworks = () => {
        void request({
            // Snapshots: the screen merges each change with the chains a
            // stored account gains from discovery while the sheet is open.
            contents: (
                <ChooseNetworksContent
                    rows={networkRows}
                    selectedChainIds={selectedChainIds}
                    requiredChainIds={requiredChainIds}
                    onChange={setChosenChainIds}
                />
            ),
            options: { size: 'modal' },
        })
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

            const draft: WalletAccount =
                account ||
                (await buildHdWalletAccount({ account: 0, keyIndex: 0 }))

            const stored = storedRecordOf(getAllAccounts(), draft, chainId)
            const targetAccount =
                isChoosingNetworks && !stored
                    ? await withSelectedChains(draft, selectedChainIds)
                    : draft

            if (stored) {
                updateAccount({ ...stored, name: trimmedName })
                if (isChoosingNetworks) {
                    // Enabled first, so dropping the rest never empties the account.
                    for (const id of selectedChainIds) {
                        if (!chainAccountOf(stored, id)) {
                            await enableChain(stored.id, id, 'user')
                        }
                    }
                    // Read again: discovery may have found activity since.
                    const current =
                        getAllAccounts().find(a => a.id === stored.id) ?? stored
                    const active = activeChainsOf(current)
                    const dropped = (
                        Object.keys(current.chains) as ChainId[]
                    ).filter(
                        id =>
                            !selectedChainIds.includes(id) &&
                            !active.includes(id),
                    )
                    if (dropped.length > 0) {
                        await disableChains(stored.id, dropped)
                    }
                }
            } else {
                await saveAccount({ ...targetAccount, name: trimmedName })
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
        isChoosingNetworks,
        selectedChainIds,
        handleEditNetworks,
    }
}

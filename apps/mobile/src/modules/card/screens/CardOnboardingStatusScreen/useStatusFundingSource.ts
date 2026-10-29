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

import { useCallback, useEffect, useMemo } from 'react'
import {
    useNavigation,
    useRoute,
    type RouteProp,
} from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import {
    CardAccountLinkedElsewhereError,
    setCardFundingSourceAddress,
    useCardStore,
    useFundingAddressLinkMutation,
} from '@perawallet/wallet-core-card'
import {
    useAllAccounts,
    useSelectedAccount,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import type { Nullable, Optional } from '@perawallet/wallet-core-shared'
import { trackEvent, CardEvent } from '@analytics'
import {
    useCardFundingSourcePicker,
    useCardErrorToast,
    isSigningCapableFundingSource,
} from '@modules/card/hooks'
import type { CardOnboardingStackParamList } from '../../routes/card-onboarding/types'
import {
    cardAccountAddressOf,
    findCardAccount,
} from '../../utils/cardAccountAddress'

export type UseStatusFundingSourceResult = {
    /** Persisted funding-source address; the display fallback when no account. */
    connectedAddress: Nullable<string>
    /** A Pera account has been linked as the funding source. */
    isFundsConnected: boolean
    /** The connected account, resolved from the wallet (undefined if removed). */
    connectedAccount: Optional<WalletAccount>
    /** Opens the account picker and links the chosen account as funding source. */
    handleConnectAccount: (source: 'connect' | 'change') => void
}

/** The checklist's Connect Funds row: the chosen account and how it is picked. */
export const useStatusFundingSource = (
    scope: ChainScope,
): UseStatusFundingSourceResult => {
    const connectedAddress = useCardStore(
        state => state.connectedFundingSourceAddress,
    )
    const isFundsConnected = connectedAddress !== null

    const accounts = useAllAccounts()
    const connectedAccount = useMemo<Optional<WalletAccount>>(
        () => findCardAccount(accounts, connectedAddress, scope.chainId),
        [accounts, connectedAddress, scope.chainId],
    )

    // After the add-account flow finishes it returns here with this one-shot
    // flag; the new account is the globally selected one, so link it as the
    // funding source.
    const route =
        useRoute<
            RouteProp<CardOnboardingStackParamList, 'CardOnboardingStatus'>
        >()
    const autoConnectSelected = route.params?.autoConnectSelected ?? false
    const stackNavigation =
        useNavigation<
            NativeStackNavigationProp<
                CardOnboardingStackParamList,
                'CardOnboardingStatus'
            >
        >()
    const { setParams } = stackNavigation
    const selectedAccount = useSelectedAccount()
    const selectedAccountAddress = selectedAccount
        ? cardAccountAddressOf(selectedAccount, scope.chainId)
        : undefined

    useEffect(() => {
        if (
            !autoConnectSelected ||
            !selectedAccountAddress ||
            selectedAccountAddress === connectedAddress
        ) {
            return
        }
        // Consume the one-shot flag so it can't re-fire on later focuses.
        setParams({ autoConnectSelected: undefined })
        // Purely local, the card gets created and linked to this account by the Pera backend
        setCardFundingSourceAddress(selectedAccountAddress)
    }, [
        autoConnectSelected,
        selectedAccountAddress,
        connectedAddress,
        setParams,
    ])

    // Creation always needs the ownership-proof signature, so only offer
    // accounts that can produce one.
    const offerSigningCapable = useCallback(
        (account: WalletAccount) =>
            isSigningCapableFundingSource(account, scope),
        [scope],
    )
    const { pickFundingSource } = useCardFundingSourcePicker({
        accountFilter: offerSigningCapable,
    })
    const { checkFundingAddress } = useFundingAddressLinkMutation(scope)
    // Same copy the post-signature failure shows, resolved from the same
    // error type rather than restating its keys here.
    const showCardError = useCardErrorToast()
    const handleConnectAccount = useCallback(
        (source: 'connect' | 'change') => {
            trackEvent(
                source === 'change'
                    ? CardEvent.CreateCardChangeAccount
                    : CardEvent.CreateConnectWallet,
            )
            void (async () => {
                const account = await pickFundingSource()
                const address = account
                    ? cardAccountAddressOf(account, scope.chainId)
                    : undefined
                if (address === undefined) return
                // Ask before the ownership signature whether the backend
                // would even accept this address: creation links it to the
                // Baanx user and refuses one held by someone else, which
                // the user would otherwise hit three prompts later. An
                // unanswerable preflight is not a refusal, so only an
                // explicit `linked_to_other` stops the connect.
                const link = await checkFundingAddress(address).catch(
                    () => null,
                )
                if (link?.state === 'linked_to_other') {
                    await showCardError(new CardAccountLinkedElsewhereError())
                    return
                }
                trackEvent(CardEvent.CreateVerifyAccountSelect)
                // Purely local, the card gets created and linked to this account by the Pera backend
                setCardFundingSourceAddress(address)
            })()
        },
        [pickFundingSource, checkFundingAddress, showCardError, scope.chainId],
    )

    return {
        connectedAddress,
        isFundsConnected,
        connectedAccount,
        handleConnectAccount,
    }
}

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

import { useCallback, useMemo } from 'react'
import {
    addressOn,
    canSignWith,
    useAllAccounts,
    useSelectedAccount,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import {
    toScopeKey,
    type ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { useSwapsStore } from '@perawallet/wallet-core-swaps'

export type UseSwapReceiveTargetResult = {
    receiveScope: ChainScope
    isCrossChain: boolean
    receivingAccount: Nullable<WalletAccount>
    receivingAddress: Nullable<string>
    /** The user's own accounts that can receive on `receiveScope`. */
    receivingAccounts: WalletAccount[]
    selectReceivingAccount: (account: WalletAccount) => void
}

/**
 * Who receives the swap's output. On the swap scope it is the swapper; on
 * another chain it is one of the user's own accounts that can sign there:
 * the one they picked, else the selected account, else the first eligible.
 */
export const useSwapReceiveTarget = (
    scope: ChainScope,
): UseSwapReceiveTargetResult => {
    const toAssetScope = useSwapsStore(state => state.toAssetScope)
    const receivingAccountId = useSwapsStore(state => state.receivingAccountId)
    const setReceivingAccountId = useSwapsStore(
        state => state.setReceivingAccountId,
    )
    const selectedAccount = useSelectedAccount()
    const accounts = useAllAccounts()

    const receiveScope = toAssetScope ?? scope
    const isCrossChain = toScopeKey(receiveScope) !== toScopeKey(scope)

    const receivingAccounts = useMemo(
        () =>
            isCrossChain
                ? accounts.filter(
                      candidate =>
                          !!addressOn(candidate, receiveScope) &&
                          canSignWith(
                              candidate,
                              accounts,
                              receiveScope.chainId,
                          ),
                  )
                : [],
        [isCrossChain, accounts, receiveScope],
    )

    const receivingAccount = useMemo<Nullable<WalletAccount>>(() => {
        if (!isCrossChain) return selectedAccount
        const findEligible = (id: Nullable<string> | undefined) =>
            receivingAccounts.find(candidate => candidate.id === id)
        return (
            findEligible(receivingAccountId) ??
            findEligible(selectedAccount?.id) ??
            receivingAccounts.at(0) ??
            null
        )
    }, [isCrossChain, selectedAccount, receivingAccounts, receivingAccountId])

    const selectReceivingAccount = useCallback(
        (account: WalletAccount) => setReceivingAccountId(account.id),
        [setReceivingAccountId],
    )

    return {
        receiveScope,
        isCrossChain,
        receivingAccount,
        receivingAddress: receivingAccount
            ? (addressOn(receivingAccount, receiveScope) ?? null)
            : null,
        receivingAccounts,
        selectReceivingAccount,
    }
}

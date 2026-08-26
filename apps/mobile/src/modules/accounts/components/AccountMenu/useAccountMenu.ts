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
    useAllAccounts,
    useSelectedAccountAddress,
    useAccountValueTotalsQuery,
    useSortedAccounts,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { useCardSession, useCardStore } from '@perawallet/wallet-core-card'
import { useIsPeraCardEnabled } from '@hooks/useIsPeraCardEnabled'
import type { AccountMenuProps } from './AccountMenu'

import type { Nullable } from '@perawallet/wallet-core-shared'

export type AccountMenuListItem =
    | { kind: 'account'; account: WalletAccount }
    | { kind: 'pera-card'; activated: boolean; nested: boolean }

type UseAccountMenuResult = {
    listItems: AccountMenuListItem[]
    selectedAccountAddress: Nullable<string>
    sortMode: string
    handleTap: (acct: WalletAccount) => void
}

export const useAccountMenu = (
    props: AccountMenuProps,
): UseAccountMenuResult => {
    const accounts = useAllAccounts()
    const { selectedAccountAddress, setSelectedAccountAddress } =
        useSelectedAccountAddress()
    const { accountValueTotals } = useAccountValueTotalsQuery(accounts, true)

    // Controlled mode: when `selectedAddress` is passed (even `null`), the caller
    // owns the highlight and tapping won't mutate the global account.
    const isControlled = props.selectedAddress !== undefined
    const effectiveSelectedAddress: Nullable<string> = isControlled
        ? (props.selectedAddress ?? null)
        : selectedAccountAddress

    const filteredAccounts = useMemo(
        () =>
            props.accountFilter
                ? accounts.filter(props.accountFilter)
                : accounts,
        [accounts, props.accountFilter],
    )

    const { sortedAccounts, sortMode } = useSortedAccounts(
        filteredAccounts,
        accountValueTotals,
    )

    const { isAuthenticated } = useCardSession()
    const connectedFundingSourceAddress = useCardStore(
        state => state.connectedFundingSourceAddress,
    )
    const isPeraCardEnabled = useIsPeraCardEnabled()

    const listItems = useMemo<AccountMenuListItem[]>(() => {
        const accountItems = sortedAccounts.map(
            (account): AccountMenuListItem => ({ kind: 'account', account }),
        )
        if (!props.showPeraCardActivation || !isPeraCardEnabled)
            return accountItems

        const connectedIndex =
            isAuthenticated && connectedFundingSourceAddress
                ? sortedAccounts.findIndex(
                      account =>
                          account.address === connectedFundingSourceAddress,
                  )
                : -1
        // Only nest (and draw the connector) when the connected account is in
        // the list; otherwise place the row right after the first account. The
        // render variant is derived from the same `nested` flag so the drawn
        // state and the placement can never diverge.
        const nested = connectedIndex >= 0
        const insertAt = nested
            ? connectedIndex + 1
            : Math.min(1, accountItems.length)
        accountItems.splice(insertAt, 0, {
            kind: 'pera-card',
            activated: isAuthenticated,
            nested,
        })
        return accountItems
    }, [
        sortedAccounts,
        props.showPeraCardActivation,
        isPeraCardEnabled,
        isAuthenticated,
        connectedFundingSourceAddress,
    ])

    const handleTap = useCallback(
        (acct: WalletAccount) => {
            if (!isControlled) setSelectedAccountAddress(acct.address)
            props?.onSelected?.(acct)
        },
        [props, isControlled, setSelectedAccountAddress],
    )

    return {
        listItems,
        selectedAccountAddress: effectiveSelectedAddress,
        sortMode,
        handleTap,
    }
}

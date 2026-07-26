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

import { useCallback, useMemo, useRef, useState } from 'react'
import {
    useAllAccounts,
    useSelectedAccountAddress,
    useAccountBalancesQuery,
    useSortedAccounts,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { useCardSession, useCardStore } from '@perawallet/wallet-core-card'
import { useIsPeraCardEnabled } from '@hooks/useIsPeraCardEnabled'
import { EXPANDABLE_PANEL_ANIMATION_DURATION } from '@constants/ui'
import type { AccountMenuProps } from './AccountMenu'

import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native'
import type { Nullable } from '@perawallet/wallet-core-shared'

// Hysteresis band: collapse past COLLAPSE_OFFSET, re-expand only within
// EXPAND_OFFSET of the top, so small scrolls don't flip the chart on and off.
const CHART_COLLAPSE_OFFSET = 48
const CHART_EXPAND_OFFSET = 8

// Settle window after a flip: on web, collapsing the ~200px chart can trigger
// browser scroll anchoring that yanks scrollTop back under the re-expand
// threshold, causing an endless collapse/expand loop. Ignoring scroll events
// for the panel's animation duration (+ margin) lets the layout settle first.
const SETTLE_MS = EXPANDABLE_PANEL_ANIMATION_DURATION + 50

export const resolveChartCollapsed = (
    wasCollapsed: boolean,
    offsetY: number,
): boolean => {
    if (!wasCollapsed && offsetY > CHART_COLLAPSE_OFFSET) return true
    if (wasCollapsed && offsetY < CHART_EXPAND_OFFSET) return false
    return wasCollapsed
}

export type AccountMenuListItem =
    | { kind: 'account'; account: WalletAccount }
    | { kind: 'pera-card'; activated: boolean; nested: boolean }

type UseAccountMenuResult = {
    listItems: AccountMenuListItem[]
    selectedAccountAddress: Nullable<string>
    sortMode: string
    handleTap: (acct: WalletAccount) => void
    isChartCollapsed: boolean
    handleListScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void
    handleExpandChart: () => void
}

export const useAccountMenu = (
    props: AccountMenuProps,
): UseAccountMenuResult => {
    const accounts = useAllAccounts()
    const { selectedAccountAddress, setSelectedAccountAddress } =
        useSelectedAccountAddress()
    const { accountBalances } = useAccountBalancesQuery(accounts, true)

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
        accountBalances,
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

    const [isChartCollapsed, setIsChartCollapsed] = useState(false)
    const lastFlipAt = useRef(0)
    const handleListScroll = useCallback(
        (event: NativeSyntheticEvent<NativeScrollEvent>) => {
            const offsetY = event.nativeEvent.contentOffset.y
            const now = Date.now()
            if (now - lastFlipAt.current < SETTLE_MS) return
            setIsChartCollapsed(prev => {
                const next = resolveChartCollapsed(prev, offsetY)
                if (next !== prev) lastFlipAt.current = now
                return next
            })
        },
        [],
    )

    const handleExpandChart = useCallback(() => {
        setIsChartCollapsed(false)
    }, [])

    return {
        listItems,
        selectedAccountAddress: effectiveSelectedAddress,
        sortMode,
        handleTap,
        isChartCollapsed,
        handleListScroll,
        handleExpandChart,
    }
}

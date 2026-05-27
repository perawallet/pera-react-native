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

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
    useAllAccounts,
    useSelectedAccountAddress,
    useAccountBalancesQuery,
    useAccountBalancesInvalidator,
    useSortedAccounts,
    WalletAccount,
} from '@perawallet/wallet-core-accounts'
import type { AccountMenuProps } from './AccountMenu'

import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native'
import type { Nullable } from '@perawallet/wallet-core-shared'

// Collapse the chart once the list scrolls past this offset, and restore it
// only once scrolled back near the top. The gap between the two (hysteresis)
// stops small scrolls from flipping the chart on and off.
const CHART_COLLAPSE_OFFSET = 48
const CHART_EXPAND_OFFSET = 8

/**
 * Hysteresis for the scroll-driven chart collapse: collapse once scrolled
 * past {@link CHART_COLLAPSE_OFFSET}, and only re-expand once back within
 * {@link CHART_EXPAND_OFFSET} of the top — between the two it holds its state.
 */
export const resolveChartCollapsed = (
    wasCollapsed: boolean,
    offsetY: number,
): boolean => {
    if (!wasCollapsed && offsetY > CHART_COLLAPSE_OFFSET) return true
    if (wasCollapsed && offsetY < CHART_EXPAND_OFFSET) return false
    return wasCollapsed
}

type UseAccountMenuResult = {
    sortedAccounts: WalletAccount[]
    selectedAccountAddress: Nullable<string>
    sortMode: string
    handleTap: (acct: WalletAccount) => void
    isChartCollapsed: boolean
    handleListScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void
}

export const useAccountMenu = (
    props: AccountMenuProps,
): UseAccountMenuResult => {
    const accounts = useAllAccounts()
    const { selectedAccountAddress, setSelectedAccountAddress } =
        useSelectedAccountAddress()
    const { invalidate } = useAccountBalancesInvalidator()
    const { accountBalances } = useAccountBalancesQuery(accounts, true)

    useEffect(() => {
        invalidate()
    }, [])

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

    const handleTap = useCallback(
        (acct: WalletAccount) => {
            setSelectedAccountAddress(acct.address)
            props?.onSelected?.(acct)
        },
        [props, setSelectedAccountAddress],
    )

    const [isChartCollapsed, setIsChartCollapsed] = useState(false)
    const handleListScroll = useCallback(
        (event: NativeSyntheticEvent<NativeScrollEvent>) => {
            const offsetY = event.nativeEvent.contentOffset.y
            setIsChartCollapsed(prev => resolveChartCollapsed(prev, offsetY))
        },
        [],
    )

    return {
        sortedAccounts,
        selectedAccountAddress,
        sortMode,
        handleTap,
        isChartCollapsed,
        handleListScroll,
    }
}

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
import { type Decimal } from 'decimal.js'
import {
    type AccountBalanceHistoryItem,
    useAccountSummaryQuery,
    useAllAccounts,
    useCanSignWith,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { useCurrency } from '@perawallet/wallet-core-currencies'
import { useSettings } from '@perawallet/wallet-core-settings'
import { useChartInteraction } from '@hooks/useChartInteraction'
import {
    type HistoryPeriod,
    type Nullable,
} from '@perawallet/wallet-core-shared'

export type UseAccountOverviewHeaderResult = {
    portfolioAlgoValue: Decimal
    portfolioPreferredValue: Decimal
    /** False while held assets are still enriching — the total is still settling. */
    isBalanceComplete: boolean
    isPending: boolean
    period: HistoryPeriod
    setPeriod: (period: HistoryPeriod) => void
    selectedPoint: Nullable<AccountBalanceHistoryItem>
    hasBalance: boolean
    canSign: boolean
    togglePrivacyMode: () => void
    handleChartSelectionChange: (
        selected: Nullable<AccountBalanceHistoryItem>,
    ) => void
}

export const useAccountOverviewHeader = (
    account: WalletAccount,
): UseAccountOverviewHeaderResult => {
    const { usdToPreferred } = useCurrency()
    const canSign = useCanSignWith(account)
    // Cheap SQL-aggregate total — no full-holdings materialization for the header.
    const {
        algoAmount,
        portfolioAlgoValue,
        portfolioUsdValue,
        isComplete,
        isPending,
    } = useAccountSummaryQuery(account?.address)
    const allAccounts = useAllAccounts()
    // Show the "get started" empty state only for a lone account with no ALGO
    // (a brand-new wallet). Any funded account, or any account in a multi-
    // account wallet, shows its balance (even 0) — gated on data, not value.
    const isOnlyEmptyAccount = allAccounts.length <= 1 && algoAmount.isZero()
    const portfolioPreferredValue = useMemo(
        () => usdToPreferred(portfolioUsdValue),
        [usdToPreferred, portfolioUsdValue],
    )

    const { period, setPeriod, selectedPoint, setSelectedPoint } =
        useChartInteraction<AccountBalanceHistoryItem>()

    const { privacyMode, setPrivacyMode } = useSettings()
    const togglePrivacyMode = useCallback(() => {
        setPrivacyMode(!privacyMode)
    }, [privacyMode, setPrivacyMode])

    // Selection only drives the displayed value and date. Locking the list and
    // pager used to hang off it too, but that flipped state three levels up and
    // re-rendered every tab at each end of a scrub — seconds of stall on a large
    // account. The chart's gesture now blocks its ancestors natively instead.
    const handleChartSelectionChange = useCallback(
        (selected: Nullable<AccountBalanceHistoryItem>) => {
            setSelectedPoint(selected)
        },
        [setSelectedPoint],
    )

    return {
        portfolioAlgoValue,
        portfolioPreferredValue,
        isBalanceComplete: isComplete,
        isPending,
        period,
        setPeriod,
        selectedPoint,
        // Drives the balance-vs-"get started" layout. True for any funded
        // account and for every account in a multi-account wallet; false only
        // for a lone, empty (0-ALGO) account.
        hasBalance: !isOnlyEmptyAccount,
        canSign,
        togglePrivacyMode,
        handleChartSelectionChange,
    }
}

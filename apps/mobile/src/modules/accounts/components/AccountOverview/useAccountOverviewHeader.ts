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

import { useCallback, useMemo } from 'react'
import { Decimal } from 'decimal.js'
import {
    AccountBalanceHistoryItem,
    useAccountSummaryQuery,
    useCanSignWith,
    WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { useCurrency } from '@perawallet/wallet-core-currencies'
import { useSettings } from '@perawallet/wallet-core-settings'
import { useChartInteraction } from '@hooks/useChartInteraction'
import { HistoryPeriod, type Nullable } from '@perawallet/wallet-core-shared'
import { useAccountOverviewModal } from './AccountOverviewModalContext'

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
        portfolioAlgoValue,
        portfolioUsdValue,
        holdingsCount,
        isComplete,
        isPending,
    } = useAccountSummaryQuery(account?.address)
    const portfolioPreferredValue = useMemo(
        () => usdToPreferred(portfolioUsdValue),
        [usdToPreferred, portfolioUsdValue],
    )

    const { period, setPeriod, selectedPoint, setSelectedPoint } =
        useChartInteraction<AccountBalanceHistoryItem>()

    const { onScrollEnabledChange } = useAccountOverviewModal()

    const { privacyMode, setPrivacyMode } = useSettings()
    const togglePrivacyMode = useCallback(() => {
        setPrivacyMode(!privacyMode)
    }, [privacyMode, setPrivacyMode])

    const handleChartSelectionChange = useCallback(
        (selected: Nullable<AccountBalanceHistoryItem>) => {
            setSelectedPoint(selected)
            onScrollEnabledChange(!selected)
        },
        [setSelectedPoint, onScrollEnabledChange],
    )

    return {
        portfolioAlgoValue,
        portfolioPreferredValue,
        isBalanceComplete: isComplete,
        isPending,
        period,
        setPeriod,
        selectedPoint,
        // Show the balance layout for any account that has holdings (every
        // synced account has at least the ALGO row), gated on data presence —
        // not on the value being > 0, so a 0 / not-yet-priced balance still
        // renders "0" instead of flipping to the empty "get started" state.
        hasBalance: holdingsCount > 0,
        canSign,
        togglePrivacyMode,
        handleChartSelectionChange,
    }
}

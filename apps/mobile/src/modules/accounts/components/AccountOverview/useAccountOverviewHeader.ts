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
    isSigningAccount,
    useAccountBalancesQuery,
    useAllAccounts,
    useAccountAuthAddresses,
    usePortfolioTotals,
    WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { useCurrency } from '@perawallet/wallet-core-currencies'
import { useSettings } from '@perawallet/wallet-core-settings'
import { useChartInteraction } from '@hooks/useChartInteraction'
import { HistoryPeriod } from '@perawallet/wallet-core-shared'
import { useAccountOverviewModal } from './AccountOverviewModalContext'

export type UseAccountOverviewHeaderResult = {
    portfolioAlgoValue: Decimal
    portfolioPreferredValue: Decimal
    isPending: boolean
    period: HistoryPeriod
    setPeriod: (period: HistoryPeriod) => void
    selectedPoint: AccountBalanceHistoryItem | null
    hasBalance: boolean
    canSign: boolean
    togglePrivacyMode: () => void
    handleChartSelectionChange: (
        selected: AccountBalanceHistoryItem | null,
    ) => void
}

export const useAccountOverviewHeader = (
    account: WalletAccount,
): UseAccountOverviewHeaderResult => {
    const { usdToPreferred } = useCurrency()
    const allAccounts = useAllAccounts()
    const { authAddresses } = useAccountAuthAddresses()
    const { portfolioAlgoValue, accountBalances, isPending } =
        useAccountBalancesQuery(account ? [account] : [])
    const { portfolioUsdValue } = usePortfolioTotals(accountBalances)
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
        (selected: AccountBalanceHistoryItem | null) => {
            setSelectedPoint(selected)
            onScrollEnabledChange(!selected)
        },
        [setSelectedPoint, onScrollEnabledChange],
    )

    return {
        portfolioAlgoValue,
        portfolioPreferredValue,
        isPending,
        period,
        setPeriod,
        selectedPoint,
        hasBalance: portfolioAlgoValue.gt(0),
        canSign: isSigningAccount(
            account,
            allAccounts,
            authAddresses.get(account.address),
        ),
        togglePrivacyMode,
        handleChartSelectionChange,
    }
}

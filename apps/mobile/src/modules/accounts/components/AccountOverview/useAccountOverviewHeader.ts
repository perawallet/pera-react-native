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
import type { Decimal } from 'decimal.js'
import {
    addressOn,
    type AccountBalanceHistoryItem,
    useAccountHoldingSources,
    useAccountScope,
    useAccountSummaryQuery,
    useAccountValueTotalsQuery,
    useAllAccounts,
    useCanSignWith,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import {
    isTestTierScope,
    LEGACY_CHAIN_ID,
} from '@perawallet/wallet-core-chain-contract'
import {
    chainDisplayNameOf,
    useChainCapabilityCheck,
    useSelectedScope,
} from '@perawallet/wallet-core-chain-shared'
import { getProvider } from '@perawallet/wallet-extension-provider'
import {
    useChainAvailability,
    type ChainAvailability,
} from '@hooks/useChainAvailability'
import { useCurrency } from '@perawallet/wallet-core-currencies'
import { useSettings } from '@perawallet/wallet-core-settings'
import { useChartInteraction } from '@hooks/useChartInteraction'
import type {
    HistoryPeriod,
    Nullable,
    Optional,
} from '@perawallet/wallet-core-shared'

export type UseAccountOverviewHeaderResult = {
    /** Unavailable: the header shows a notice instead of balances and actions. */
    availability: ChainAvailability
    /** Undefined for a chain this build doesn't register. */
    chainName: Optional<string>
    /**
     * Every chain the account holds assets on has balance history. The chart
     * plots only those chains, so once the total counts another it would
     * contradict it.
     */
    hasBalanceHistory: boolean
    /**
     * Across every chain the account is on, leaving out test-network holdings
     * once a second chain is registered. `null` while any counted value or the
     * preferred-currency rate is unknown — renders as a placeholder, not 0.
     */
    portfolioPreferredValue: Nullable<Decimal>
    /** False when every chain the account is on is a test network: there's no fiat total to show. */
    hasFiatTotal: boolean
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
    const scope = useAccountScope(account, LEGACY_CHAIN_ID)
    const availability = useChainAvailability(scope.chainId)
    const sources = useAccountHoldingSources(account)
    const check = useChainCapabilityCheck()
    const hasBalanceHistory =
        sources.length > 0 &&
        sources.every(source =>
            check({
                chain: {
                    chainId: source.scope.chainId,
                    capability: 'balanceHistory',
                },
            }),
        )
    const hasFiatTotal = sources.some(
        source => !isTestTierScope(getProvider().chains, source.scope),
    )
    const chainName = chainDisplayNameOf(scope.chainId)
    const currencyScope = useSelectedScope(LEGACY_CHAIN_ID)
    const { usdToPreferred } = useCurrency(currencyScope)
    const canSign = useCanSignWith(account, scope.chainId)
    // Cheap SQL aggregates — no full-holdings materialization for the header.
    const { nativeAmount, isComplete } = useAccountSummaryQuery(
        addressOn(account, scope),
        scope,
    )
    const valuedAccounts = useMemo(() => [account], [account])
    const { portfolioFiatValue, isPending } = useAccountValueTotalsQuery(
        valuedAccounts,
        currencyScope,
        availability.isAvailable,
    )
    const allAccounts = useAllAccounts()
    // Show the "get started" empty state only for a lone account with no native balance
    // (a brand-new wallet). Any funded account, or any account in a multi-
    // account wallet, shows its balance (even 0) — gated on data, not value.
    const isOnlyEmptyAccount = allAccounts.length <= 1 && nativeAmount.isZero()
    const portfolioPreferredValue = useMemo(
        () => usdToPreferred(portfolioFiatValue),
        [usdToPreferred, portfolioFiatValue],
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
        availability,
        chainName,
        hasBalanceHistory,
        portfolioPreferredValue,
        hasFiatTotal,
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

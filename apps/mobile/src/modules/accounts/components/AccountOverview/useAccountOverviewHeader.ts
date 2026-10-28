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
import { Decimal } from 'decimal.js'
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
    // The chart plots `scope` alone, so an account spanning another chain
    // would show a chart that contradicts its total.
    const hasBalanceHistory =
        sources.length > 0 &&
        sources.every(source => source.scope.chainId === scope.chainId) &&
        check({
            chain: { chainId: scope.chainId, capability: 'balanceHistory' },
        })
    // Test-network holdings never count as money (once a second chain is
    // registered), so they stay out of the total.
    const countedSources = useMemo(
        () =>
            sources.filter(
                source => !isTestTierScope(getProvider().chains, source.scope),
            ),
        [sources],
    )
    const hasFiatTotal = countedSources.length > 0
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
    const { accountValueTotals, isPending } = useAccountValueTotalsQuery(
        valuedAccounts,
        currencyScope,
        availability.isAvailable,
    )
    // Summed over the chains the list and chart read, not every chain the
    // account has an entry on: a switched-off chain's last-synced value would
    // otherwise inflate the headline. One unknown value makes the total unknown.
    const portfolioFiatValue = useMemo(
        () =>
            countedSources.reduce<Nullable<Decimal>>((total, source) => {
                const fiatValue =
                    accountValueTotals.get(source.address)?.fiatValue ?? null
                return total === null || fiatValue === null
                    ? null
                    : total.plus(fiatValue)
            }, new Decimal(0)),
        [countedSources, accountValueTotals],
    )
    const allAccounts = useAllAccounts()
    // The account's own chain is the first source (registry order), and keeps
    // today's native-balance test; any other chain counts once it holds value.
    const isEmptyOnOtherChains = sources.slice(1).every(source => {
        const nativeValue = accountValueTotals.get(source.address)?.nativeValue
        return nativeValue !== null && (nativeValue?.isZero() ?? true)
    })
    // Show the "get started" empty state only for a lone account with nothing
    // on any chain (a brand-new wallet). Any funded account, or any account in a
    // multi-account wallet, shows its balance (even 0) — gated on data, not value.
    const isOnlyEmptyAccount =
        allAccounts.length <= 1 && nativeAmount.isZero() && isEmptyOnOtherChains
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

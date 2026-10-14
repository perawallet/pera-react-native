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

import { useMemo } from 'react'
import { useQueries } from '@tanstack/react-query'
import { Decimal } from 'decimal.js'
import { useStableIdList, type Nullable } from '@perawallet/wallet-core-shared'
import { useChainCapability } from '@perawallet/wallet-core-chain-shared'
import {
    isTestTierScope,
    type ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import { getProvider } from '@perawallet/wallet-extension-provider'
import type { WalletAccount } from '../models'
import { chainAccountOf } from '../credentials/accessors'
import { getAccountSummaryQueryKey } from './querykeys'
import { readAccountSummary } from './useAccountSummaryQuery'
import { valueAccountTotals } from './valueAccountTotals'

export type AccountValueTotals = {
    /** Account value expressed in the native asset (display units). */
    nativeValue: Decimal
    /**
     * Account value in USD (display units); `null` when the native asset is
     * held but its price has never synced, so the value is genuinely unknown —
     * not 0.
     */
    usdValue: Nullable<Decimal>
    /**
     * Same contract as `AccountBalance.fiatValue`. Unlike `usdValue`, an
     * unpriced native balance is `null` on every network.
     */
    fiatValue: Nullable<Decimal>
    isPending: boolean
    isFetched: boolean
    isRefetching: boolean
    isError: boolean
}

export type AccountValueTotalsMap = Map<string, AccountValueTotals>

export type UseAccountValueTotalsQueryResult = {
    accountValueTotals: AccountValueTotalsMap
    portfolioNativeValue: Decimal
    /**
     * `null` when any account's USD value is unknown — see `usdValue`. `0`
     * when `hasFiatTotal` is false.
     */
    portfolioUsdValue: Nullable<Decimal>
    /** False on a test-tier scope, whose value never counts toward the fiat total. */
    hasFiatTotal: boolean
    isPending: boolean
    isFetched: boolean
    isRefetching: boolean
    isError: boolean
    isPaused: boolean
}

const EMPTY_RESULT_BASE = {
    portfolioNativeValue: new Decimal(0),
    portfolioUsdValue: new Decimal(0),
    isPending: false,
    isFetched: false,
    isRefetching: false,
    isError: false,
    isPaused: false,
}

/**
 * Account values without the per-holding rows: one SQL aggregate per account
 * (shared, by query key, with `useAccountSummaryQuery`'s header read) instead
 * of `useAccountBalancesQuery`'s full holdings walk. This is what the account
 * list, sort sheet, and portfolio header should use — on a 10k-asset wallet
 * the holdings walk is a multi-second JS stall per render storm.
 * Reach for `useAccountBalancesQuery` only where per-asset rows are needed.
 */
export const useAccountValueTotalsQuery = (
    accounts: WalletAccount[],
    scope: ChainScope,
    enabled?: boolean,
): UseAccountValueTotalsQueryResult => {
    // See `valueAccountTotals`: only a chain with a price source can be
    // missing a price it ought to have.
    const hasPricing = useChainCapability(scope.chainId, 'pricing')
    const hasAccounts = !!accounts?.length
    const hasFiatTotal = useMemo(
        () => !isTestTierScope(getProvider().chains, scope),
        [scope],
    )

    // Call sites routinely pass fresh array literals per render; only
    // addresses are read below, so the memos key on this stable list instead
    // of array identity (see useAccountBalancesQuery for the long version).
    const addresses = useStableIdList(
        accounts?.flatMap(
            a => chainAccountOf(a, scope.chainId)?.address ?? [],
        ) ?? [],
    )

    const queries = useMemo(() => {
        return addresses.map(address => {
            return {
                queryKey: getAccountSummaryQueryKey(address, scope),
                enabled: !!address && enabled !== false,
                staleTime: Infinity,
                // SQLite is the source of truth; run the queryFn even while
                // offline instead of pausing it (TanStack's default
                // networkMode: 'online'), which would strand consumers in
                // `pending`.
                networkMode: 'always' as const,
                // See useAccountBalancesQuery: works around a QueriesObserver
                // race under Proxy-based property tracking.
                notifyOnChangeProps: 'all' as const,
                queryFn: () => readAccountSummary(address, scope),
            }
        })
    }, [addresses, enabled, scope])

    const results = useQueries({ queries })

    // Stable stand-in for `results`, whose array identity churns per render.
    const resultsSig = results
        .map(
            (r, i) =>
                `${addresses[i] ?? ''}|${r.dataUpdatedAt}|${
                    r.isPending ? 1 : 0
                }${r.isFetched ? 1 : 0}${r.isRefetching ? 1 : 0}${
                    r.isError ? 1 : 0
                }${r.isPaused ? 1 : 0}`,
        )
        .join('||')

    return useMemo(() => {
        if (!hasAccounts) {
            return {
                accountValueTotals: new Map() as AccountValueTotalsMap,
                ...EMPTY_RESULT_BASE,
                hasFiatTotal,
            }
        }

        let portfolioNativeValue = new Decimal(0)
        let portfolioUsdValue: Nullable<Decimal> = new Decimal(0)
        const accountValueTotals: AccountValueTotalsMap = new Map(
            addresses.map((address, i) => {
                const r = results[i]
                const { nativeValue, usdValue, fiatValue } = valueAccountTotals(
                    r?.data,
                    hasPricing,
                )

                portfolioNativeValue = portfolioNativeValue.plus(nativeValue)
                // One unknown account makes the portfolio total unknown —
                // silently summing the rest would understate it.
                if (hasFiatTotal) {
                    portfolioUsdValue =
                        portfolioUsdValue === null || usdValue === null
                            ? null
                            : portfolioUsdValue.plus(usdValue)
                }

                return [
                    address,
                    {
                        nativeValue,
                        usdValue,
                        fiatValue,
                        isPending: r?.isPending ?? false,
                        isFetched: r?.isFetched ?? false,
                        isRefetching: r?.isRefetching ?? false,
                        isError: r?.isError ?? false,
                    },
                ]
            }),
        )

        return {
            accountValueTotals,
            portfolioNativeValue,
            portfolioUsdValue,
            hasFiatTotal,
            isPending: results.some(r => r.isPending),
            isFetched: results.every(r => r.isFetched),
            isRefetching: results.some(r => r.isRefetching),
            isError: results.some(r => r.isError),
            isPaused: results.some(r => r.isPaused),
        }
        // `results` is read inside but deliberately not a dep — `resultsSig`
        // is its stable stand-in.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [resultsSig, addresses, hasAccounts, hasPricing, hasFiatTotal])
}

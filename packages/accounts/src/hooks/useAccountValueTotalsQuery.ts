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
import { ALGO_ASSET_ID, useStableIdList } from '@perawallet/wallet-core-shared'
import { useAssetPricesQuery } from '@perawallet/wallet-core-assets'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import type { WalletAccount } from '../models'
import { getAccountSummaryQueryKey } from './querykeys'
import { readAccountSummary } from './useAccountSummaryQuery'

export type AccountValueTotals = {
    /** Account value expressed in ALGO (display units). */
    algoValue: Decimal
    /** Account value in USD (display units). */
    usdValue: Decimal
    isPending: boolean
    isFetched: boolean
    isRefetching: boolean
    isError: boolean
}

export type AccountValueTotalsMap = Map<string, AccountValueTotals>

export type UseAccountValueTotalsQueryResult = {
    accountValueTotals: AccountValueTotalsMap
    portfolioAlgoValue: Decimal
    portfolioUsdValue: Decimal
    isPending: boolean
    isFetched: boolean
    isRefetching: boolean
    isError: boolean
    isPaused: boolean
}

const EMPTY_RESULT_BASE = {
    portfolioAlgoValue: new Decimal(0),
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
    enabled?: boolean,
): UseAccountValueTotalsQueryResult => {
    const { network } = useNetwork()
    const hasAccounts = !!accounts?.length

    // Call sites routinely pass fresh array literals per render; only
    // addresses are read below, so the memos key on this stable list instead
    // of array identity (see useAccountBalancesQuery for the long version).
    const addresses = useStableIdList(accounts?.map(a => a.address) ?? [])

    const queries = useMemo(() => {
        return addresses.map(address => {
            return {
                queryKey: getAccountSummaryQueryKey(address, network),
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
                queryFn: () => readAccountSummary(address, network),
            }
        })
    }, [addresses, enabled, network])

    const results = useQueries({ queries })
    const { data: algoPrices } = useAssetPricesQuery([ALGO_ASSET_ID])
    const usdAlgoPrice =
        algoPrices?.get(ALGO_ASSET_ID)?.usdPrice ?? new Decimal(0)
    const usdAlgoPriceKey = usdAlgoPrice.toString()

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
            }
        }

        let portfolioAlgoValue = new Decimal(0)
        let portfolioUsdValue = new Decimal(0)
        const accountValueTotals: AccountValueTotalsMap = new Map(
            addresses.map((address, i) => {
                const r = results[i]
                const algoAmount = r?.data?.algoAmount ?? new Decimal(0)
                const nonAlgoUsdValue =
                    r?.data?.nonAlgoUsdValue ?? new Decimal(0)

                // Same derivation as useAccountSummaryQuery: ALGO contributes
                // its raw amount to the ALGO-denominated total (1:1,
                // price-independent); non-ALGO holdings convert via the
                // ALGO/USD rate, or drop out of the ALGO total while the rate
                // is unknown.
                const usdValue = nonAlgoUsdValue.plus(
                    algoAmount.times(usdAlgoPrice),
                )
                const algoValue = usdAlgoPrice.isZero()
                    ? algoAmount
                    : algoAmount.plus(nonAlgoUsdValue.div(usdAlgoPrice))

                portfolioAlgoValue = portfolioAlgoValue.plus(algoValue)
                portfolioUsdValue = portfolioUsdValue.plus(usdValue)

                return [
                    address,
                    {
                        algoValue,
                        usdValue,
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
            portfolioAlgoValue,
            portfolioUsdValue,
            isPending: results.some(r => r.isPending),
            isFetched: results.every(r => r.isFetched),
            isRefetching: results.some(r => r.isRefetching),
            isError: results.some(r => r.isError),
            isPaused: results.some(r => r.isPaused),
        }
        // `results` / `usdAlgoPrice` are read inside but deliberately not
        // deps — `resultsSig` / `usdAlgoPriceKey` are their stable stand-ins.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [resultsSig, addresses, hasAccounts, usdAlgoPriceKey])
}

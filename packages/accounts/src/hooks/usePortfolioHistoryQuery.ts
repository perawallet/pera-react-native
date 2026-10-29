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
import { useQueries, type UseQueryResult } from '@tanstack/react-query'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { useChainCapabilityCheck } from '@perawallet/wallet-core-chain-shared'
import { useCurrency } from '@perawallet/wallet-core-currencies'
import type { HistoryPeriod, Nullable } from '@perawallet/wallet-core-shared'
import type { AccountHoldingSource } from '../db'
import type { AccountAddress, PortfolioValueHistoryItem } from '../models'
import {
    fetchPortfolioHistory,
    type PortfolioHistoryPoint,
} from '../chain-adapter'
import { sumPortfolioHistories } from '../portfolio-history'
import { getAccountBalancesHistoryQueryKey } from './querykeys'

export type UsePortfolioHistoryQueryResult = {
    data: PortfolioValueHistoryItem[]
    isPending: boolean
    isError: boolean
    isPaused: boolean
    error: Nullable<Error>
    /** True when a source's chain has no portfolio history: a chart without it would understate the total. */
    isUnavailableOnNetwork: boolean
    refetch: () => void
}

type ScopeGroup = { scope: ChainScope; addresses: AccountAddress[] }

const groupByScope = (sources: AccountHoldingSource[]): ScopeGroup[] => {
    const groups = new Map<string, ScopeGroup>()
    for (const { address, scope } of sources) {
        const key = `${scope.chainId}::${scope.networkId}`
        const group = groups.get(key)
        if (group) group.addresses.push(address)
        else groups.set(key, { scope, addresses: [address] })
    }
    return [...groups.values()]
}

/** The summed fiat history of every source, one request per scope. */
export const usePortfolioHistoryQuery = (
    sources: AccountHoldingSource[],
    period: HistoryPeriod,
    currencyScope: ChainScope,
    enabled = true,
): UsePortfolioHistoryQueryResult => {
    const { usdToPreferred } = useCurrency(currencyScope)
    const check = useChainCapabilityCheck()
    const groups = useMemo(() => groupByScope(sources), [sources])
    const isCapabilityOff = groups.some(
        ({ scope }) =>
            !check({
                chain: { chainId: scope.chainId, capability: 'balanceHistory' },
            }),
    )

    const combine = useCallback(
        (results: UseQueryResult<Nullable<PortfolioHistoryPoint[]>>[]) => ({
            hasSourceMissing: results.some(result => result.data === null),
            // The sum skips empty series, so a chain still loading or failed
            // must not reach it as one, or the chart would plot the rest alone.
            data: (results.some(result => result.data === undefined)
                ? []
                : sumPortfolioHistories(
                      results.map(result => result.data ?? []),
                  )
            ).map(({ timestamp, usdValue }) => ({
                datetime: new Date(timestamp),
                preferredValue: usdToPreferred(usdValue),
            })),
            isPending: results.some(result => result.isPending),
            isError: results.some(result => result.isError),
            isPaused: results.some(result => result.isPaused),
            error: results.find(result => result.error)?.error ?? null,
            refetchAll: () => {
                for (const result of results) void result.refetch()
            },
        }),
        [usdToPreferred],
    )

    const combined = useQueries({
        queries: groups.map(({ scope, addresses }) => ({
            queryKey: getAccountBalancesHistoryQueryKey(
                addresses,
                period,
                scope,
            ),
            // Gated by callers on chart visibility — this hits a slow network
            // endpoint and is only needed to render the wealth chart/trend.
            enabled: enabled && !isCapabilityOff,
            queryFn: () => fetchPortfolioHistory(addresses, period, scope),
        })),
        combine,
    })

    const isUnavailableOnNetwork = isCapabilityOff || combined.hasSourceMissing

    return {
        // A disabled query keeps its cached (and persisted) points; the chart
        // draws data ahead of the unavailable state, so a kill switch must drop them.
        data: isUnavailableOnNetwork ? [] : combined.data,
        isPending:
            isUnavailableOnNetwork || groups.length === 0
                ? false
                : combined.isPending,
        isError: combined.isError,
        isPaused: combined.isPaused,
        error: combined.error,
        isUnavailableOnNetwork,
        // The observer's refetch() ignores `enabled` and would still fire the
        // doomed request on a chain without the source.
        refetch: () => {
            if (!isCapabilityOff) combined.refetchAll()
        },
    }
}

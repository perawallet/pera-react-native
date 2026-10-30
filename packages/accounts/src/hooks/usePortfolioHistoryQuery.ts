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
import type {
    ChainId,
    ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import { useChainCapabilityCheck } from '@perawallet/wallet-core-chain-shared'
import { useCurrency } from '@perawallet/wallet-core-currencies'
import {
    isIntegrityRequiredError,
    type HistoryPeriod,
    type Nullable,
} from '@perawallet/wallet-core-shared'
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
    /** Chains whose history failed while another chain's loaded: `data` plots the rest without them. */
    excludedChainIds: ChainId[]
    /** `excludedChainIds` isn't empty: `data` falls short of the total of every source. */
    isPartial: boolean
    refetch: () => void
}

const EMPTY_CHAIN_IDS: ChainId[] = []

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
        (results: UseQueryResult<Nullable<PortfolioHistoryPoint[]>>[]) => {
            // One chain's failure leaves the others plottable; the chart then
            // names what it left out. An integrity block is the user's to
            // resolve, so it still fails the chart rather than hiding a chain,
            // and so does a failure beside chains with no points to plot.
            const failed = results.map(
                result =>
                    result.isError &&
                    result.data === undefined &&
                    !isIntegrityRequiredError(result.error),
            )
            const isPartial =
                failed.some(Boolean) &&
                results.some(
                    (result, index) =>
                        !failed[index] &&
                        (result.isPending || (result.data?.length ?? 0) > 0),
                )
            const counted = isPartial
                ? results.filter((_, index) => !failed[index])
                : results
            const excludedChainIds = isPartial
                ? [
                      ...new Set(
                          groups
                              .filter((_, index) => failed[index])
                              .map(({ scope }) => scope.chainId),
                      ),
                  ]
                : EMPTY_CHAIN_IDS
            return {
                hasSourceMissing: counted.some(result => result.data === null),
                // The sum skips empty series, so a chain still loading or
                // failed must not reach it as one, or the chart would plot
                // the rest alone.
                data: (counted.some(result => result.data === undefined)
                    ? []
                    : sumPortfolioHistories(
                          counted.map(result => result.data ?? []),
                      )
                ).map(({ timestamp, usdValue }) => ({
                    datetime: new Date(timestamp),
                    preferredValue: usdToPreferred(usdValue),
                })),
                excludedChainIds,
                isPending: counted.some(result => result.isPending),
                isError: counted.some(result => result.isError),
                isPaused: counted.some(result => result.isPaused),
                error: counted.find(result => result.error)?.error ?? null,
                refetchAll: () => {
                    for (const result of results) void result.refetch()
                },
            }
        },
        [usdToPreferred, groups],
    )

    const combined = useQueries({
        queries: groups.map(({ scope, addresses }) => ({
            queryKey: getAccountBalancesHistoryQueryKey(
                addresses,
                period,
                scope,
            ),
            // Callers gate this on what they render: it hits a slow network
            // endpoint.
            enabled: enabled && !isCapabilityOff,
            queryFn: (): Promise<Nullable<PortfolioHistoryPoint[]>> =>
                fetchPortfolioHistory(addresses, period, scope),
        })),
        combine,
    })

    const isUnavailableOnNetwork = isCapabilityOff || combined.hasSourceMissing
    const excludedChainIds = isUnavailableOnNetwork
        ? EMPTY_CHAIN_IDS
        : combined.excludedChainIds

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
        excludedChainIds,
        isPartial: excludedChainIds.length > 0,
        // The observer's refetch() ignores `enabled` and would still fire the
        // doomed request on a chain without the source.
        refetch: () => {
            if (!isCapabilityOff) combined.refetchAll()
        },
    }
}

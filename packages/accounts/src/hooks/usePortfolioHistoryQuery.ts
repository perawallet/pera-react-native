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

import { useCallback, useMemo, useRef } from 'react'
import { hashKey, useQueries, type UseQueryResult } from '@tanstack/react-query'
import type {
    ChainId,
    ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import { useChainCapabilityCheck } from '@perawallet/wallet-core-chain-shared'
import { useCurrency } from '@perawallet/wallet-core-currencies'
import {
    isChainRefusedError,
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
    /** A chain failed with no points to fall back on, and stays failed while it is asked again; a failed refresh of one that still has points doesn't count. */
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

// TanStack clears a no-data query's error when it refetches, so
// `errorUpdateCount` is what keeps a chain being asked again marked as failed.
const hasFailedWithoutData = (
    result: UseQueryResult<Nullable<PortfolioHistoryPoint[]>>,
): boolean =>
    result.data === undefined && (result.isError || result.errorUpdateCount > 0)

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

    const queryKeys = useMemo(
        () =>
            groups.map(({ scope, addresses }) =>
                getAccountBalancesHistoryQueryKey(addresses, period, scope),
            ),
        [groups, period],
    )
    const queryHashes = useMemo(() => queryKeys.map(hashKey), [queryKeys])
    const lastErrors = useRef(new Map<string, Error>())

    const combine = useCallback(
        (results: UseQueryResult<Nullable<PortfolioHistoryPoint[]>>[]) => {
            // The error of a chain with no points, kept through the retry that
            // makes TanStack clear it, so a block or a failure doesn't blink off
            // each time the chain is asked again.
            const failures = results.map((result, index) => {
                const hash = queryHashes[index] ?? ''
                if (result.isError && result.data === undefined) {
                    lastErrors.current.set(hash, result.error)
                }
                const hasFailed = hasFailedWithoutData(result)
                if (!hasFailed) return { hasFailed, error: null }
                const error = result.isError
                    ? result.error
                    : (lastErrors.current.get(hash) ?? null)
                return { hasFailed, error }
            })
            // One chain's failure leaves the others plottable; the chart then
            // names what it left out. An integrity block is the user's to
            // resolve, so it still fails the chart rather than hiding a chain,
            // and so does a failure beside chains with no points to plot.
            const failed = failures.map(
                ({ hasFailed, error }) =>
                    hasFailed && !isIntegrityRequiredError(error),
            )
            const holdsError = failures.map(
                ({ hasFailed, error }) => hasFailed && error !== null,
            )
            const isPartial =
                failed.some(Boolean) &&
                results.some(
                    (result, index) =>
                        !failed[index] &&
                        (result.isPending || (result.data?.length ?? 0) > 0),
                )
            const countedIndexes = results.flatMap((_, index) =>
                isPartial && failed[index] ? [] : [index],
            )
            const counted = countedIndexes.map(index => results[index]!)
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
                // A chain that holds its error is being asked again, not
                // loading for the first time.
                isPending: countedIndexes.some(
                    index => results[index]?.isPending && !holdsError[index],
                ),
                isError: countedIndexes.some(index => holdsError[index]),
                isPaused: counted.some(result => result.isPaused),
                error:
                    failures[
                        countedIndexes.find(index => holdsError[index]) ?? -1
                    ]?.error ?? null,
                refetchAll: () => {
                    for (const result of results) void result.refetch()
                },
            }
        },
        [usdToPreferred, groups, queryHashes],
    )

    const combined = useQueries({
        queries: groups.map(({ scope, addresses }, index) => ({
            queryKey: queryKeys[index],
            // Callers gate this on what they render: it hits a slow network
            // endpoint.
            enabled: enabled && !isCapabilityOff,
            // A chain the backend hasn't switched on has no priced value in
            // the total either, so it adds nothing rather than failing.
            queryFn: ({ signal }): Promise<Nullable<PortfolioHistoryPoint[]>> =>
                fetchPortfolioHistory(addresses, period, scope, signal).catch(
                    (error: unknown) => {
                        if (isChainRefusedError(error)) return []
                        throw error
                    },
                ),
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

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
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { useChainCapability } from '@perawallet/wallet-core-chain-shared'
import { type Nullable, type Optional } from '@perawallet/wallet-core-shared'
import { useQuery } from '@tanstack/react-query'
import type { Decimal } from 'decimal.js'
import { getAccountPortfolioTotals } from '../db'
import { ensureAccountFetched } from '../sync/account-syncer'
import { getAccountSummaryQueryKey } from './querykeys'
import { useOtherRegisteredChainIds } from './accountChainEntries'
import { valueAccountTotals } from './valueAccountTotals'

export type UseAccountSummaryResult = {
    /** Native asset balance in display units (price-independent). */
    nativeAmount: Decimal
    /**
     * Total portfolio value in USD (includes the native asset); `null` when it
     * is held but its price has never synced, so the value is unknown — not 0.
     */
    portfolioUsdValue: Nullable<Decimal>
    /** Total portfolio value expressed in the native asset; `null` when unknown — see `valueAccountTotals`. */
    portfolioNativeValue: Nullable<Decimal>
    /** Number of holdings (includes the native holding). */
    holdingsCount: number
    /**
     * False while held assets are still being enriched (metadata syncing), so
     * the displayed total is still settling — drives the header's balance spinner.
     */
    isComplete: boolean
    isPending: boolean
    isError: boolean
    isPaused: boolean
}

/**
 * Shared queryFn for the per-account SQL portfolio totals. Exported so
 * `useAccountValueTotalsQuery` can populate the exact same cache entries this
 * hook reads — the header and the account lists share one query per account.
 */
export const readAccountSummary = async (
    address: string,
    scope: ChainScope,
) => {
    // Self-heal a freshly imported/selected account the background sync
    // hasn't populated yet (deduped with the holdings-page fetch).
    await ensureAccountFetched(address, scope)
    return getAccountPortfolioTotals({ accountAddress: address, scope })
}

/**
 * Cheap, use-case-specific portfolio summary for the account header.
 *
 * The total is a single SQL aggregate over the account's holdings — no per-row
 * `PeraAsset` materialization and no `WHERE assetId IN (…)` price read — so it
 * stays fast for accounts holding thousands of assets. The native asset's
 * amount and price come back in the same aggregate, so no price query is needed
 * to express the total in native terms.
 */
export const useAccountSummaryQuery = (
    address: Optional<string>,
    scope: ChainScope,
): UseAccountSummaryResult => {
    const hasPricing = useChainCapability(scope.chainId, 'pricing')
    // See `valueAccountTotals`: single-chain wallets keep today's figures.
    const isUnconvertibleUnknown =
        useOtherRegisteredChainIds(scope.chainId).length > 0

    const query = useQuery({
        queryKey: getAccountSummaryQueryKey(address ?? '', scope),
        enabled: !!address,
        staleTime: Infinity,
        // SQLite is the source of truth; run the queryFn even while offline
        // instead of pausing it (TanStack's default networkMode: 'online'),
        // which would strand consumers in `pending`. Network segments are
        // already caught in the syncer.
        networkMode: 'always',
        queryFn: () => readAccountSummary(address as string, scope),
    })

    return useMemo(() => {
        const { nativeAmount, nativeValue, usdValue } = valueAccountTotals(
            query.data,
            hasPricing,
            isUnconvertibleUnknown,
        )

        return {
            nativeAmount,
            portfolioUsdValue: usdValue,
            portfolioNativeValue: nativeValue,
            holdingsCount: query.data?.holdingsCount ?? 0,
            // Complete once we have data and no held asset is still missing
            // its metadata (the enrichment pass has caught up).
            isComplete:
                !!query.data && (query.data.missingMetadataCount ?? 0) === 0,
            isPending: !!address && query.isPending,
            isError: query.isError,
            isPaused: query.isPaused,
        }
    }, [
        query.data,
        query.isPending,
        query.isError,
        query.isPaused,
        address,
        hasPricing,
        isUnconvertibleUnknown,
    ])
}

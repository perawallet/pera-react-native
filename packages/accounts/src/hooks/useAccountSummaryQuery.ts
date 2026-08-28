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
import {
    ALGO_ASSET_ID,
    type Network,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import { useQuery } from '@tanstack/react-query'
import { Decimal } from 'decimal.js'
import { useAssetPricesQuery } from '@perawallet/wallet-core-assets'
import { isPeraBackedNetwork } from '@perawallet/wallet-core-config'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import { getAccountPortfolioTotals } from '../db'
import { ensureAccountFetched } from '../sync/account-syncer'
import { getAccountSummaryQueryKey } from './querykeys'

export type UseAccountSummaryResult = {
    /** ALGO balance in display units (price-independent). */
    algoAmount: Decimal
    /**
     * Total portfolio value in USD (includes ALGO); `null` when ALGO is held
     * but its price has never synced, so the value is unknown — not 0.
     */
    portfolioUsdValue: Nullable<Decimal>
    /** Total portfolio value expressed in ALGO. */
    portfolioAlgoValue: Decimal
    /** Number of holdings (includes the ALGO holding). */
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
export const readAccountSummary = async (address: string, network: Network) => {
    // Self-heal a freshly imported/selected account the background sync
    // hasn't populated yet (deduped with the holdings-page fetch).
    await ensureAccountFetched(address, network)
    return getAccountPortfolioTotals({
        accountAddress: address,
        network,
    })
}

/**
 * Cheap, use-case-specific portfolio summary for the account header.
 *
 * The total is a single SQL aggregate over the account's holdings — no per-row
 * `PeraAsset` materialization and no `WHERE assetId IN (…)` price read — so it
 * stays fast for accounts holding thousands of assets. ALGO participates as a
 * regular holding, so its value is already in the SQL sum; the ALGO/USD rate is
 * only needed to express the USD total in ALGO terms.
 */
export const useAccountSummaryQuery = (
    address?: string,
): UseAccountSummaryResult => {
    const { network } = useNetwork()

    const query = useQuery({
        queryKey: getAccountSummaryQueryKey(address ?? '', network),
        enabled: !!address,
        staleTime: Infinity,
        // SQLite is the source of truth; run the queryFn even while offline
        // instead of pausing it (TanStack's default networkMode: 'online'),
        // which would strand consumers in `pending`. Network segments are
        // already caught in the syncer.
        networkMode: 'always',
        queryFn: () => readAccountSummary(address as string, network),
    })

    const { data: algoPrices } = useAssetPricesQuery([ALGO_ASSET_ID])

    return useMemo(() => {
        const algoAmount = query.data?.algoAmount ?? new Decimal(0)
        const nonAlgoUsdValue = query.data?.nonAlgoUsdValue ?? new Decimal(0)
        const usdAlgoPrice =
            algoPrices?.get(ALGO_ASSET_ID)?.usdPrice ?? new Decimal(0)

        // ALGO contributes its raw amount to the ALGO-denominated total (1:1,
        // price-independent); non-ALGO holdings convert via the ALGO/USD rate.
        //
        // Valuing held ALGO needs that rate, so a never-synced install (no
        // price rows) can't express the USD total at all — `null`, not 0.
        // Networks with no Pera backend are excluded: a zero rate is the
        // deliberate answer there (PERA-4928), not a missing one.
        // See useAccountValueTotalsQuery, which derives this identically.
        const portfolioUsdValue =
            usdAlgoPrice.isZero() &&
            !algoAmount.isZero() &&
            isPeraBackedNetwork(network)
                ? null
                : nonAlgoUsdValue.plus(algoAmount.times(usdAlgoPrice))
        const portfolioAlgoValue = usdAlgoPrice.isZero()
            ? algoAmount
            : algoAmount.plus(nonAlgoUsdValue.div(usdAlgoPrice))

        return {
            algoAmount,
            portfolioUsdValue,
            portfolioAlgoValue,
            holdingsCount: query.data?.holdingsCount ?? 0,
            // Complete once we have data and no held asset is still missing
            // its metadata (the enrichment pass has caught up).
            isComplete:
                !!query.data && (query.data.missingMetadataCount ?? 0) === 0,
            isPending: query.isPending,
            isError: query.isError,
            isPaused: query.isPaused,
        }
    }, [query.data, query.isPending, query.isError, query.isPaused, algoPrices])
}

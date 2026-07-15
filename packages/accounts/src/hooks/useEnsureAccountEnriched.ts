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

import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
    fetchAndPersistAssets,
    fetchAndPersistPrices,
} from '@perawallet/wallet-core-assets'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import { logger } from '@perawallet/wallet-core-shared'
import { getAccountHoldings } from '../db'
import { ensureAccountFetched } from '../sync/account-syncer'
import { invalidateAccountQueriesForAddresses } from './querykeys'

/**
 * Drives a viewed account to a fully-enriched state: holdings → asset metadata
 * → prices, invalidating the account's queries after each phase so the header
 * and list fill in progressively.
 *
 * This is deliberately decoupled from the background poll. That poll only runs
 * the (expensive) asset/price pass when holdings changed *in the same tick* or a
 * coarse interval elapses — so a holdings write that lands out-of-band (e.g. the
 * on-demand fetch when first viewing a freshly imported account) can leave the
 * rows as skeletons until the resync interval. Viewing an account is the right
 * moment to guarantee its data is current; both fetchers skip already-fresh
 * assets, so repeat views are cheap.
 */
export const useEnsureAccountEnriched = (address?: string): void => {
    const { network } = useNetwork()
    const queryClient = useQueryClient()

    useEffect(() => {
        if (!address) return
        let cancelled = false

        const invalidate = () => {
            if (!cancelled) {
                invalidateAccountQueriesForAddresses(queryClient, [address])
            }
        }

        void (async () => {
            try {
                // 1. Holdings + balance (deduped with the read hooks' fetch).
                await ensureAccountFetched(address, network)
                if (cancelled) return
                invalidate()

                // 2. Enrich held assets (metadata + prices in parallel), then
                // invalidate once. A single trailing invalidation keeps the
                // list from churning/re-pinning repeatedly mid-load.
                const holdings = await getAccountHoldings({
                    accountAddress: address,
                    network,
                })
                const ids = holdings.map(h => h.assetId)
                if (ids.length === 0) return

                await Promise.allSettled([
                    fetchAndPersistAssets(ids, network),
                    fetchAndPersistPrices(ids, network),
                ])
                invalidate()
            } catch (error) {
                logger.warn('Account enrichment failed', {
                    address,
                    network,
                    error:
                        error instanceof Error
                            ? { message: error.message, stack: error.stack }
                            : error,
                })
            }
        })()

        return () => {
            cancelled = true
        }
    }, [address, network, queryClient])
}

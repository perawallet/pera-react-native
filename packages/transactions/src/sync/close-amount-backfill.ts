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

import { Decimal } from 'decimal.js'
import { logger, type Network } from '@perawallet/wallet-core-shared'
import type { Database } from '@perawallet/wallet-core-database'
import {
    getCloseRowsMissingCloseAmount,
    updateTransactionCloseAmount,
} from '../db'

// Lazy: the endpoints module reaches react-native-mmkv through queryClient,
// which cannot load in the node test environment. Deferring the import keeps
// this module (and everything that imports it) collectable there.
const defaultFetchCloseAmount = async (
    txId: string,
    network: Network,
): Promise<string | null> => {
    const { fetchIndexerCloseAmount } =
        await import('../api/history/indexer/endpoints')
    return fetchIndexerCloseAmount(txId, network)
}

type BackfillParams = {
    db?: Database
    network: Network
    /**
     * Resolves a transaction's swept close amount (base units, decimal
     * string) from the chain indexer; null when the transaction has no close
     * leg. Injectable for tests; defaults to the indexer lookup the detail
     * screen uses.
     */
    fetchCloseAmount?: (
        txId: string,
        network: Network,
    ) => Promise<string | null>
}

/**
 * Heals close-involving rows whose swept amount is unknown — rows cached
 * before the close_amount column existed, or synced from a perspective whose
 * balance impacts couldn't reveal it — by asking the chain indexer, which is
 * perspective-free truth. Bounded and best-effort: a failed lookup leaves the
 * row matching the predicate, so the next sync pass retries it naturally.
 * Never throws; the sync that triggered it must not fail on cosmetics.
 */
export async function backfillMissingCloseAmounts({
    db,
    network,
    fetchCloseAmount = defaultFetchCloseAmount,
}: BackfillParams): Promise<void> {
    let rows: Array<{ id: string }>
    try {
        rows = await getCloseRowsMissingCloseAmount({ db, network })
    } catch (error) {
        logger.warn('close-amount backfill: work-list query failed', { error })
        return
    }

    for (const { id } of rows) {
        try {
            const closeAmount = await fetchCloseAmount(id, network)
            if (closeAmount === null) continue
            await updateTransactionCloseAmount({
                db,
                id,
                network,
                closeAmount: new Decimal(closeAmount),
            })
        } catch (error) {
            logger.warn('close-amount backfill: lookup failed; will retry', {
                error,
                id,
            })
        }
    }
}

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

import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { logger, type Nullable } from '@perawallet/wallet-core-shared'
import type { Database } from '@perawallet/wallet-core-database'
import {
    getRowsByChainData,
    setChainDataValue,
} from '@perawallet/wallet-core-transactions'
import { algorandNetworkOf } from '../../network-id'
import { fetchIndexerCloseAmount } from '../history/indexer/endpoints'
import {
    CLOSE_AMOUNT_PATH,
    CLOSE_AMOUNT_SETTLED_PATH,
    CLOSE_TO_PATH,
} from './chain-data'

type BackfillParams = {
    db?: Database
    scope: ChainScope
    accountAddress: string
    /**
     * Resolves a transaction's swept close amount (base units, decimal
     * string) from the indexer; null when the transaction has no close leg.
     * Injectable for tests.
     */
    fetchCloseAmount?: (
        txId: string,
        scope: ChainScope,
    ) => Promise<Nullable<string>>
}

const defaultFetchCloseAmount = (txId: string, scope: ChainScope) =>
    fetchIndexerCloseAmount(txId, algorandNetworkOf(scope))

/**
 * Heals close-involving rows whose swept amount is unknown — rows cached
 * before the swept amount was recorded, or synced from a perspective whose
 * balance impacts couldn't reveal it — by asking the chain indexer, which is
 * perspective-free truth. Bounded and best-effort: a failed lookup leaves the
 * row matching the predicate, so the next sync pass retries it naturally.
 * Never throws; the sync that triggered it must not fail on cosmetics.
 */
export async function backfillMissingCloseAmounts({
    db,
    scope,
    accountAddress,
    fetchCloseAmount = defaultFetchCloseAmount,
}: BackfillParams): Promise<void> {
    let rows: Array<{ id: string }>
    try {
        rows = await getRowsByChainData({
            db,
            scope,
            accountAddress,
            present: [CLOSE_TO_PATH],
            missing: [CLOSE_AMOUNT_PATH, CLOSE_AMOUNT_SETTLED_PATH],
        })
    } catch (error) {
        logger.warn('close-amount backfill: work-list query failed', { error })
        return
    }

    for (const { id } of rows) {
        try {
            const closeAmount = await fetchCloseAmount(id, scope)
            // The indexer answered and has no amount to give, so asking again
            // can't help; settle the row instead of leaving it on the list.
            await setChainDataValue({
                db,
                scope,
                id,
                ...(closeAmount === null
                    ? { path: CLOSE_AMOUNT_SETTLED_PATH, value: true }
                    : { path: CLOSE_AMOUNT_PATH, value: closeAmount }),
            })
        } catch (error) {
            logger.warn('close-amount backfill: lookup failed; will retry', {
                error,
                id,
            })
        }
    }
}

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
import type { Database } from '@perawallet/wallet-core-database'
import { logger } from '@perawallet/wallet-core-shared'
import { fetchSwapOrder } from '@perawallet/wallet-core-swaps'
import {
    getChainDataValue,
    getRowsByChainData,
    setChainDataValue,
} from '@perawallet/wallet-core-transactions'
import { SWAP_LEG_ORDER_ID_PATH, SWAP_LEG_STATUS_PATH } from './chain-data'

const OPEN_STATUSES = ['pending', 'in_progress']

type RefreshParams = {
    db?: Database
    scope: ChainScope
    accountAddress: string
    /** The order's current status. Injectable for tests. */
    fetchOrderStatus?: (orderId: string, scope: ChainScope) => Promise<string>
}

const defaultFetchOrderStatus = async (orderId: string, scope: ChainScope) =>
    (await fetchSwapOrder(orderId, scope)).status

/**
 * Brings the order status of cached swap legs up to date while their order is
 * open. A deposit syncs seconds after it's sent, with its order in progress,
 * and nothing re-reads the row once a later day is cached, so without this its
 * row would read "In progress" for good. A failed lookup leaves the row open
 * for the next pass. Never throws.
 */
export async function refreshOpenSwapLegs({
    db,
    scope,
    accountAddress,
    fetchOrderStatus = defaultFetchOrderStatus,
}: RefreshParams): Promise<void> {
    let rows: Array<{ id: string }>
    try {
        rows = await getRowsByChainData({
            db,
            scope,
            accountAddress,
            oneOf: [{ path: SWAP_LEG_STATUS_PATH, values: OPEN_STATUSES }],
        })
    } catch (error) {
        logger.warn('swap leg refresh: work-list query failed', { error })
        return
    }

    for (const { id } of rows) {
        try {
            const orderId = await getChainDataValue({
                db,
                scope,
                id,
                path: SWAP_LEG_ORDER_ID_PATH,
            })
            if (orderId === null) continue
            const status = await fetchOrderStatus(orderId, scope)
            if (OPEN_STATUSES.includes(status)) continue
            await setChainDataValue({
                db,
                scope,
                id,
                path: SWAP_LEG_STATUS_PATH,
                value: status,
            })
        } catch (error) {
            logger.warn('swap leg refresh: lookup failed; will retry', {
                error,
                id,
            })
        }
    }
}

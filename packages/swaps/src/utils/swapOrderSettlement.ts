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

import type { SwapStatus, SwapTrackedOrder } from '../models'

/** How long a provider may still overturn an expired or cancelled order. */
export const SWAP_STATUS_REVERSIBLE_MS = 7 * 24 * 60 * 60 * 1000

/** Past this, an order the router never finished stops being followed. */
export const SWAP_ORDER_TRACKING_LIMIT_MS = 30 * 24 * 60 * 60 * 1000

const FINAL_STATUSES: ReadonlySet<SwapStatus> = new Set([
    'completed',
    'failed',
    'refunded',
])

const REVERSIBLE_STATUSES: ReadonlySet<SwapStatus> = new Set([
    'expired',
    'cancelled',
])

/** `now` and `createdAt` are epoch ms. */
export const isSwapOrderSettled = (
    order: Pick<SwapTrackedOrder, 'status' | 'createdAt'>,
    now: number,
): boolean => {
    if (FINAL_STATUSES.has(order.status)) return true
    const limit = REVERSIBLE_STATUSES.has(order.status)
        ? SWAP_STATUS_REVERSIBLE_MS
        : SWAP_ORDER_TRACKING_LIMIT_MS
    return now - order.createdAt >= limit
}

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

import { i18nKey, type I18nKey } from '@perawallet/wallet-core-chain-contract'
import type { SwapStatus } from '@perawallet/wallet-core-swaps'
import type { Nullable } from '@perawallet/wallet-core-shared'

const KEYS: Record<SwapStatus, Nullable<I18nKey>> = {
    pending: i18nKey('swap.history.list.item.status.in_progress'),
    in_progress: i18nKey('swap.history.list.item.status.in_progress'),
    completed: null,
    failed: i18nKey('swap.history.list.item.status.failed'),
    refunded: i18nKey('swap.history.list.item.status.refunded'),
    // Never listed: see VISIBLE_SWAP_STATUSES.
    expired: null,
    cancelled: null,
}

/** A completed swap shows its date instead, so it has no label. */
export const swapHistoryStatusKey = (status: SwapStatus): Nullable<I18nKey> =>
    KEYS[status]

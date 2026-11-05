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

const KEYS: Record<SwapStatus, I18nKey> = {
    pending: i18nKey('swap.tracking.in_progress'),
    in_progress: i18nKey('swap.tracking.in_progress'),
    completed: i18nKey('swap.tracking.completed'),
    failed: i18nKey('swap.tracking.failed'),
    refunded: i18nKey('swap.tracking.refunded'),
    expired: i18nKey('swap.tracking.expired'),
    cancelled: i18nKey('swap.tracking.cancelled'),
}

export const swapTrackingStatusKey = (status: SwapStatus): I18nKey =>
    KEYS[status]

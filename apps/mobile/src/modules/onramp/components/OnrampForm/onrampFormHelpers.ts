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

import type { Platform } from 'react-native'
import type { Decimal } from 'decimal.js'
import {
    ANDROID_EXCLUDED_PAYMENT_METHODS,
    IOS_EXCLUDED_PAYMENT_METHODS,
    type RampHistoryItem,
    type RampOrder,
    type RampPair,
    type RampToken,
} from '@perawallet/wallet-core-onramp'
import type { Nullable } from '@perawallet/wallet-core-shared'

/** Payment-method ids excluded on the given platform (matches the web filter). */
export const getExcludedPaymentMethodIds = (
    platform: typeof Platform.OS,
): readonly string[] => {
    if (platform === 'android') return ANDROID_EXCLUDED_PAYMENT_METHODS
    if (platform === 'ios') return IOS_EXCLUDED_PAYMENT_METHODS
    return []
}

/** Fiat sources go through the provider checkout (Meld); crypto ones through a deposit. */
export const isMeldPair = (pair: Nullable<RampPair>): boolean =>
    pair?.sourceToken.kind === 'fiat'

/** The chain a source pays from, as the router names it; the token's own name when it gives none. */
export const sourceNetworkLabelOf = (token: RampToken): string =>
    token.network.name !== '' ? token.network.name : token.name

/**
 * Shape a freshly-created deposit order as a (pending) history item so the
 * order-details sheet can render the post-order review — a just-placed order is
 * exactly a pending history entry, so the two share one component.
 */
export const buildPendingXoHistoryItem = (
    order: Extract<RampOrder, { kind: 'xo' }>,
    pair: RampPair,
    sourceAmount: Decimal,
    destinationAmount: Nullable<Decimal>,
    toAddress: string,
    creationDatetime: string,
): RampHistoryItem => ({
    id: order.orderId,
    kind: 'xo',
    status: 'pending',
    creationDatetime,
    provider: 'xo',
    pair,
    sourceAmount,
    destinationAmount,
    toAddress,
    payInAddress: order.deposit.address,
    payInAddressTag: order.deposit.memo ?? undefined,
})

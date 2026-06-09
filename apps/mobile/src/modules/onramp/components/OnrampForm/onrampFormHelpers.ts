/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { type Platform } from 'react-native'
import { type Decimal } from 'decimal.js'
import {
    ANDROID_EXCLUDED_PAYMENT_METHODS,
    IOS_EXCLUDED_PAYMENT_METHODS,
    type RampHistoryItem,
    type RampPair,
    type XoOrder,
} from '@perawallet/wallet-core-onramp'
import { type Nullable } from '@perawallet/wallet-core-shared'

/** Payment-method ids excluded on the given platform (matches the web filter). */
export const getExcludedPaymentMethodIds = (
    platform: typeof Platform.OS,
): readonly string[] => {
    if (platform === 'android') return ANDROID_EXCLUDED_PAYMENT_METHODS
    if (platform === 'ios') return IOS_EXCLUDED_PAYMENT_METHODS
    return []
}

export const isMeldPair = (pair: Nullable<RampPair>): boolean =>
    pair?.provider.id.toLowerCase() === 'meld'

/**
 * Shape a freshly-created XO order as a (pending) history item so the
 * order-details sheet can render the post-order review — a just-placed order is
 * exactly a pending history entry, so the two share one component. `paymentMethod`
 * is left blank (XO is crypto-to-crypto, so the details sheet hides that row).
 */
export const buildPendingXoHistoryItem = (
    order: XoOrder,
    pair: RampPair,
    sourceAmount: Decimal,
    destinationAmount: Nullable<Decimal>,
    creationDatetime: string,
): RampHistoryItem => ({
    id: order.swapOrderId,
    status: 'pending',
    creationDatetime,
    provider: 'xo',
    pair,
    paymentMethod: { id: 'crypto', logo: null, name: '' },
    sourceAmount,
    destinationAmount,
    sourceCurrencyCode: null,
    destinationCurrencyCode: null,
    swapOrderId: order.swapOrderId,
    payInAddress: order.payInAddress,
    payInAddressTag: order.payInAddressTag,
    toAddress: order.toAddress,
})

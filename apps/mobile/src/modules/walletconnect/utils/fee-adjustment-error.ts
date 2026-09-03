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

import {
    FEE_ADJUSTMENT_DELIVERY_MESSAGE_MARKER,
    FeeAdjustmentDeliveryError,
} from '@perawallet/wallet-core-signing'

/**
 * WalletConnect rebuilds a fresh error from only the original's `.message`
 * before it reaches the error channel, so a `FeeAdjustmentDeliveryError`'s
 * `.name` does not survive that hop for the transaction-signing flow. Match
 * on `.name` for callers that see the error directly, and fall back to the
 * message marker every `FeeAdjustmentDeliveryError` is constructed with (see
 * packages/signing/src/pipeline/errors.ts) for the rewrapped case.
 *
 * The distinction is user-visible: a quantum fee-adjustment that could not be
 * delivered gets its own copy rather than the raw transport message.
 */
export const isFeeAdjustmentDeliveryError = (error: Error): boolean =>
    error.name === FeeAdjustmentDeliveryError.name ||
    error.message.includes(FEE_ADJUSTMENT_DELIVERY_MESSAGE_MARKER)

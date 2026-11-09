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

import { AppError, ErrorCategory } from '@perawallet/wallet-core-shared'

import type { RampOrder } from '../../models'
import {
    depositInstructionsStepSchema,
    openCheckoutStepSchema,
    type RampOrderApiResponse,
} from './schema'

// The order's steps say what the user does next: open the provider's
// checkout, or pay into a deposit address. A malformed step throws rather than
// degrading to "no usable step".
export const transformRampOrder = (api: RampOrderApiResponse): RampOrder => {
    const checkout = api.steps.find(step => step.kind === 'open_checkout')
    if (checkout) {
        return {
            kind: 'meld',
            orderId: api.order_id,
            checkoutUrl: openCheckoutStepSchema.parse(checkout).url,
        }
    }

    const deposit = api.steps.find(step => step.kind === 'deposit_instructions')
    if (deposit) {
        const parsed = depositInstructionsStepSchema.parse(deposit)
        return {
            kind: 'xo',
            orderId: api.order_id,
            deposit: { address: parsed.address, memo: parsed.memo ?? null },
        }
    }

    throw new AppError('The order has no checkout or deposit step.', {
        category: ErrorCategory.UNKNOWN,
        recoverable: false,
    })
}

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
import { routerRequest } from '@perawallet/wallet-core-swaps'

import type { RampOrder } from '../../models'
import { createRampOrderResponseSchema } from './schema'
import { transformRampOrder } from './transformers'

export type CreateRampOrderParams = {
    quoteId: string
}

/** The router reads accounts and amounts from the stored quote, never from this call. */
export const createRampOrder = async (
    params: CreateRampOrderParams,
    scope: ChainScope,
): Promise<RampOrder> => {
    const data = await routerRequest({
        scope,
        method: 'POST',
        path: 'orders/',
        data: { quote_id: params.quoteId },
    })
    return transformRampOrder(createRampOrderResponseSchema.parse(data))
}

export type CancelRampOrderParams = {
    orderId: string
}

/** Only a pending order cancels; the router answers 409 for any other status. */
export const cancelRampOrder = async (
    params: CancelRampOrderParams,
    scope: ChainScope,
): Promise<void> => {
    await routerRequest({
        scope,
        method: 'PATCH',
        path: `orders/${encodeURIComponent(params.orderId)}/`,
        data: { status: 'cancelled' },
    })
}

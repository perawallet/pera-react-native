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

import {
    queryClient,
    type Network,
    type Nullable,
} from '@perawallet/wallet-core-shared'

import type { RampOrder } from '../../models'
import {
    cancelRampOrderResponseSchema,
    createRampOrderResponseSchema,
    type CancelRampOrderApiResponse,
    type RampOrderApiResponse,
} from './schema'
import { transformRampOrder } from './transformers'

export type CreateRampOrderParams = {
    quote: string
    sourceAmount: string
    sourceAddress: Nullable<string>
}

export const createRampOrder = async (
    params: CreateRampOrderParams,
    network: Network,
    signal?: AbortSignal,
): Promise<RampOrder> => {
    const response = await queryClient<RampOrderApiResponse>({
        backend: 'pera',
        network,
        method: 'POST',
        url: `/v1/ramp/orders/`,
        data: {
            quote: params.quote,
            source_amount: params.sourceAmount,
            source_address: params.sourceAddress,
        },
        signal,
    })

    const parsed = createRampOrderResponseSchema.parse(response.data)
    return transformRampOrder(parsed)
}

export type CancelRampOrderParams = {
    swapOrderId: string
    deviceId: string
    accountAddress: string
}

export const cancelRampOrder = async (
    params: CancelRampOrderParams,
    network: Network,
    signal?: AbortSignal,
): Promise<void> => {
    const response = await queryClient<CancelRampOrderApiResponse>({
        backend: 'pera',
        network,
        method: 'POST',
        url: `/v1/ramp/orders/cancel/`,
        data: {
            swap_order_id: params.swapOrderId,
            device_id: params.deviceId,
            account_address: params.accountAddress,
        },
        signal,
    })

    cancelRampOrderResponseSchema.parse(response.data)
}

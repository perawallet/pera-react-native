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
    queryClient,
    type Network,
    type Nullable,
} from '@perawallet/wallet-core-shared'

import type { RampQuote } from '../../models'
import {
    createRampQuoteResponseSchema,
    type CreateRampQuoteApiResponse,
} from './schema'
import { transformRampQuote } from './transformers'

export type CreateRampQuoteParams = {
    pair: string
    destinationAddress: string
    sourceAmount: Nullable<number>
}

export const createRampQuote = async (
    params: CreateRampQuoteParams,
    network: Network,
    signal?: AbortSignal,
): Promise<RampQuote[]> => {
    const response = await queryClient<CreateRampQuoteApiResponse>({
        backend: 'pera',
        network,
        method: 'POST',
        url: `/v1/ramp/quotes/`,
        data: {
            pair: params.pair,
            destination_address: params.destinationAddress,
            source_amount: params.sourceAmount,
        },
        signal,
    })

    const parsed = createRampQuoteResponseSchema.parse(response.data)
    return parsed.map(transformRampQuote)
}

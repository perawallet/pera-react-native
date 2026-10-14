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
import { queryClient } from '@perawallet/wallet-core-shared'

import type { RampPair } from '../../models'
import { rampPairsResponseSchema, type RampPairsApiResponse } from './schema'
import { transformRampPair } from './transformers'

export const getRampPairs = async (
    destinationTokenIds: string[],
    scope: ChainScope,
): Promise<RampPair[]> => {
    const response = await queryClient<RampPairsApiResponse>({
        backend: 'pera',
        scope,
        method: 'GET',
        url: `/v1/ramp/pairs/`,
        params: { destination_tokens: destinationTokenIds.join(',') },
    })

    const parsed = rampPairsResponseSchema.parse(response.data)
    return parsed.map(transformRampPair)
}

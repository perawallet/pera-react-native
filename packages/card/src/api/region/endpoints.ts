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

import { queryClient } from '@perawallet/wallet-core-shared'
import type { Network } from '@perawallet/wallet-core-shared'
import type { CurrentRegion } from '../../models'
import { currentRegionResponseSchema } from './schema'
import { transformCurrentRegion } from './transformers'

export type FetchCurrentRegionParams = {
    network: Network
    signal?: AbortSignal
}

/**
 * Geo-IP detected region from Pera's backend (not Baanx), used to preselect the
 * onboarding country. Goes through the shared `queryClient` like the waitlist.
 */
export const fetchCurrentRegion = async (
    params: FetchCurrentRegionParams,
): Promise<CurrentRegion> => {
    const response = await queryClient<unknown>({
        backend: 'pera',
        network: params.network,
        method: 'GET',
        url: 'v1/cards/supported-countries/',
        signal: params.signal,
    })
    return transformCurrentRegion(
        currentRegionResponseSchema.parse(response.data),
    )
}

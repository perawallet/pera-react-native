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

import { queryClient, type Network } from '@perawallet/wallet-core-shared'

import type { OnrampStatus } from '../../models'
import {
    rampHistoryPageSchema,
    type RampHistoryPageApiResponse,
} from './schema'
import { transformRampHistoryPage, type RampHistoryPage } from './transformers'

export type GetRampHistoryParams = {
    deviceId: string
    accountAddress: string
    status?: OnrampStatus
}

export const getRampHistory = async (
    params: GetRampHistoryParams,
    network: Network,
    signal?: AbortSignal,
): Promise<RampHistoryPage> => {
    const response = await queryClient<RampHistoryPageApiResponse>({
        backend: 'pera',
        network,
        method: 'GET',
        url: `/v1/ramp/history/${params.deviceId}/${params.accountAddress}/`,
        params: params.status ? { status: params.status } : undefined,
        signal,
    })

    const parsed = rampHistoryPageSchema.parse(response.data)
    return transformRampHistoryPage(parsed)
}

// Follows an absolute pagination URL (`next`/`previous` from a prior page).
//
// The API returns fully-qualified URLs
// (`https://<host>/v1/ramp/history/...?offset=...`). `queryClient` is backed by
// ky with a per-network `prefix`, and ky 2.x unconditionally concatenates
// `prefix + input` — even when `input` is already absolute — which would yield
// a doubled URL. To reuse the instrumented client (API-key headers, retry,
// logging, MSW interception) we strip the absolute URL down to its
// `pathname + search` and let `queryClient` re-apply the prefix for the
// supplied `network`. `network` is required because the absolute host alone
// does not reliably distinguish environments (mainnet/testnet share a host
// family); the caller already holds the active network.
export const getRampHistoryByUrl = async (
    url: string,
    network: Network,
    signal?: AbortSignal,
): Promise<RampHistoryPage> => {
    const parsedUrl = new URL(url)
    const relativeUrl = `${parsedUrl.pathname}${parsedUrl.search}`

    const response = await queryClient<RampHistoryPageApiResponse>({
        backend: 'pera',
        network,
        method: 'GET',
        url: relativeUrl,
        signal,
    })

    const parsed = rampHistoryPageSchema.parse(response.data)
    return transformRampHistoryPage(parsed)
}

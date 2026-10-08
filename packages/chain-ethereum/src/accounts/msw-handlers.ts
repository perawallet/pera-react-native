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

import { http, HttpResponse, type RequestHandler } from 'msw'
import {
    peraEvmAssetHandlers,
    type PeraEvmAssetFixtures,
} from '../assets/api/msw-handlers'
import { SHOULD_REFRESH_PATH, type ShouldRefreshResponse } from './endpoints'

export type ShouldRefreshRequest = {
    /** CAIP-2, e.g. `eip155:1`. */
    chain: string
    account_addresses: string[]
    /** A block number on EVM; null when never synced. */
    last_refreshed_round: number | null
}

export type PeraEvmFixtures = PeraEvmAssetFixtures & {
    /**
     * A number is the HTTP status the endpoint fails with. Defaults to the
     * backend's quiet chain: a refresh at block 1 on a null cursor (it always
     * refreshes one), no refresh otherwise.
     */
    blockFollowing?:
        | ShouldRefreshResponse
        | number
        | ((request: ShouldRefreshRequest) => ShouldRefreshResponse | number)
}

const quietChain = ({
    last_refreshed_round,
}: ShouldRefreshRequest): ShouldRefreshResponse =>
    last_refreshed_round === null
        ? { refresh: true, round: 1 }
        : { refresh: false }

/** The Pera backend's EVM endpoints. */
export const peraEvmHandlers = ({
    blockFollowing = quietChain,
    ...assetFixtures
}: PeraEvmFixtures = {}): RequestHandler[] => [
    http.post(
        `${(assetFixtures.baseUrl ?? '*').replace(/\/+$/, '')}${SHOULD_REFRESH_PATH}`,
        async ({ request }) => {
            const outcome =
                typeof blockFollowing === 'function'
                    ? blockFollowing(
                          (await request.json()) as ShouldRefreshRequest,
                      )
                    : blockFollowing
            return typeof outcome === 'number'
                ? HttpResponse.json({}, { status: outcome })
                : HttpResponse.json(outcome)
        },
    ),
    ...peraEvmAssetHandlers(assetFixtures),
]

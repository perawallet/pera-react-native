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
import { SHOULD_REFRESH_PATH, type ShouldRefreshResponse } from './endpoints'

export type ShouldRefreshRequest = {
    account_addresses: string[]
    last_refreshed_block: number | null
}

export type PeraEvmFixtures = {
    /** Defaults to every host. */
    baseUrl?: string
    /** A number is the HTTP status the endpoint fails with. */
    blockFollowing?:
        | ShouldRefreshResponse
        | number
        | ((request: ShouldRefreshRequest) => ShouldRefreshResponse | number)
}

/** The Pera backend's Ethereum endpoints; block following only, until the spec covers the rest. */
export const peraEvmHandlers = ({
    baseUrl = '*',
    blockFollowing = { refresh: false, block: 1 },
}: PeraEvmFixtures = {}): RequestHandler[] => [
    http.post(
        `${baseUrl.replace(/\/+$/, '')}${SHOULD_REFRESH_PATH}`,
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
]

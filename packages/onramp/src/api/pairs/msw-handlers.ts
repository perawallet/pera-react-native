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

import { http, HttpResponse, type HttpHandler } from 'msw'
import { validateMockResponse } from '@perawallet/wallet-core-shared/test-utils'
import { SWAP_ROUTER_PATH } from '@perawallet/wallet-core-swaps'

import {
    rampPairsMockResponseSchema,
    rampPairsQuerySchema,
    type RampPairsMockResponse,
} from './schema'

export type MockRampPairsParams = {
    response: RampPairsMockResponse
    status?: number
}

const pairsHandler = (
    { response, status = 200 }: MockRampPairsParams,
    name: string,
    appliesTo: (hasDestination: boolean) => boolean,
): HttpHandler => {
    validateMockResponse(rampPairsMockResponseSchema, response, name)
    return http.get(`*${SWAP_ROUTER_PATH}pairs/`, ({ request }) => {
        const params = new URL(request.url).searchParams
        if (!appliesTo(params.has('destination'))) return undefined
        const query = rampPairsQuerySchema.safeParse(Object.fromEntries(params))
        if (!query.success) {
            return HttpResponse.json(
                { error: 'Invalid request', details: query.error.issues },
                { status: 422 },
            )
        }
        return HttpResponse.json(response, { status })
    })
}

/** Serves the destination list: a pairs request with no `destination`. */
export const mockRampDestinations = (
    params: MockRampPairsParams,
): HttpHandler =>
    pairsHandler(
        params,
        'mockRampDestinations',
        hasDestination => !hasDestination,
    )

/** Serves the sources of any destination: a pairs request carrying `destination`. */
export const mockRampSources = (params: MockRampPairsParams): HttpHandler =>
    pairsHandler(params, 'mockRampSources', hasDestination => hasDestination)

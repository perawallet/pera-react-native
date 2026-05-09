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

import { http, HttpResponse, type HttpHandler } from 'msw'
import { validateMockResponse } from '@perawallet/wallet-core-shared/test-utils'
import {
    providersResponseSchema,
    topPairsResponseSchema,
    type ProvidersApiResponse,
    type TopPairsApiResponse,
} from './schema'

export type MockSwapProvidersParams = {
    response: ProvidersApiResponse
    status?: number
}

export const mockSwapProviders = ({
    response,
    status = 200,
}: MockSwapProvidersParams): HttpHandler => {
    validateMockResponse(
        providersResponseSchema,
        response,
        'mockSwapProviders',
    )
    return http.get('*/v2/dex-swap/providers/', () =>
        HttpResponse.json(response, { status }),
    )
}

export type MockTopPairsParams = {
    response: TopPairsApiResponse
    status?: number
}

export const mockTopPairs = ({
    response,
    status = 200,
}: MockTopPairsParams): HttpHandler => {
    validateMockResponse(topPairsResponseSchema, response, 'mockTopPairs')
    return http.get('*/v2/dex-swap/top-pairs/', () =>
        HttpResponse.json(response, { status }),
    )
}

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

// Thin MSW handler factories for the name-service REST surface.

import { http, HttpResponse, type HttpHandler } from 'msw'
import { validateMockResponse } from '@perawallet/wallet-core-shared/test-utils'
import {
    nfdBulkReadResponseSchema,
    nameSearchResponseSchema,
    type NfdBulkReadApiResponse,
    type NameSearchApiResponse,
} from './schema'

export type MockNfdBulkReadParams = {
    response: NfdBulkReadApiResponse
    status?: number
}

export const mockNfdBulkRead = ({
    response,
    status = 200,
}: MockNfdBulkReadParams): HttpHandler => {
    validateMockResponse(nfdBulkReadResponseSchema, response, 'mockNfdBulkRead')
    return http.post('*/api/v4/accounts/names/', () =>
        HttpResponse.json(response, { status }),
    )
}

export type MockNameSearchParams = {
    response: NameSearchApiResponse
    status?: number
}

export const mockNameSearch = ({
    response,
    status = 200,
}: MockNameSearchParams): HttpHandler => {
    validateMockResponse(nameSearchResponseSchema, response, 'mockNameSearch')
    return http.get('*/api/v4/name-services/search/', () =>
        HttpResponse.json(response, { status }),
    )
}

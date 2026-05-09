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

// Thin MSW handler factories for the NFD REST surface.

import { http, HttpResponse, type HttpHandler } from 'msw'
import { validateMockResponse } from '@perawallet/wallet-core-shared/test-utils'
import {
    nfdBulkReadResponseSchema,
    nfdNamesListResponseSchema,
    nfdSearchResponseSchema,
    type NfdNamesListApiResponse,
    type NfdBulkReadApiResponse,
    type NfdSearchApiResponse,
} from './schema'

export type MockNfdNamesForAddressParams = {
    address: string
    response: NfdNamesListApiResponse
    status?: number
}

export const mockNfdNamesForAddress = ({
    address,
    response,
    status = 200,
}: MockNfdNamesForAddressParams): HttpHandler => {
    validateMockResponse(
        nfdNamesListResponseSchema,
        response,
        'mockNfdNamesForAddress',
    )
    return http.get(`*/v1/accounts/${address}/names/`, () =>
        HttpResponse.json(response, { status }),
    )
}

export type MockNfdBulkReadParams = {
    response: NfdBulkReadApiResponse
    status?: number
}

export const mockNfdBulkRead = ({
    response,
    status = 200,
}: MockNfdBulkReadParams): HttpHandler => {
    validateMockResponse(
        nfdBulkReadResponseSchema,
        response,
        'mockNfdBulkRead',
    )
    return http.post('*/v1/accounts/names/bulk-read/', () =>
        HttpResponse.json(response, { status }),
    )
}

export type MockNfdSearchParams = {
    response: NfdSearchApiResponse
    status?: number
}

export const mockNfdSearch = ({
    response,
    status = 200,
}: MockNfdSearchParams): HttpHandler => {
    validateMockResponse(nfdSearchResponseSchema, response, 'mockNfdSearch')
    return http.get('*/v1/name-services/search/', () =>
        HttpResponse.json(response, { status }),
    )
}

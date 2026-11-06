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
    addressNamesResponseSchema,
    nameSearchResponseSchema,
    type AddressNamesApiResponse,
    type NameSearchApiResponse,
} from './schema'

export type AddressNamesRequestBody = { chain: string; addresses: string[] }

export type MockAddressNamesParams = {
    /** A function answers each request from its body; a static response is validated up front. */
    response:
        | AddressNamesApiResponse
        | ((body: AddressNamesRequestBody) => AddressNamesApiResponse)
    status?: number
}

export const mockAddressNames = ({
    response,
    status = 200,
}: MockAddressNamesParams): HttpHandler => {
    if (typeof response !== 'function') {
        validateMockResponse(
            addressNamesResponseSchema,
            response,
            'mockAddressNames',
        )
    }
    return http.post('*/api/v4/accounts/names/', async ({ request }) => {
        if (typeof response !== 'function') {
            return HttpResponse.json(response, { status })
        }
        const body = response((await request.json()) as AddressNamesRequestBody)
        validateMockResponse(
            addressNamesResponseSchema,
            body,
            'mockAddressNames',
        )
        return HttpResponse.json(body, { status })
    })
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

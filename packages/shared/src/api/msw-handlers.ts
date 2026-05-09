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
// Reuse the wire-format type from the production fetcher so this mock
// stays coupled to the real API contract — schema drift breaks both at
// once.
import type { RawFastLookupResponse } from './account-fast-lookup'

export type MockAccountFastLookupParams = {
    address: string
    response: RawFastLookupResponse
    status?: number
}

export const mockAccountFastLookup = ({
    address,
    response,
    status = 200,
}: MockAccountFastLookupParams): HttpHandler =>
    http.get(`*/v1/accounts/fast-lookup/${address}/`, () =>
        HttpResponse.json(response, { status }),
    )

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

// Thin MSW handler factories for the currencies REST surface. These know two
// things: the URL pattern and the response shape. They take no defaults —
// callers (tests) supply the fixture data and any per-scenario behavior.
//
// The path globs (`*\/v1/currencies/...`) match both mainnet and testnet
// hosts so handlers don't need to know the network.

import { http, HttpResponse, type HttpHandler } from 'msw'
import type { CurrencyApiResponse } from './schema'

export type MockListCurrenciesParams = {
    response: CurrencyApiResponse[]
    status?: number
}

export const mockListCurrencies = ({
    response,
    status = 200,
}: MockListCurrenciesParams): HttpHandler =>
    http.get('*/v1/currencies/', () => HttpResponse.json(response, { status }))

export type MockGetCurrencyParams = {
    id: string
    response: CurrencyApiResponse
    status?: number
}

export const mockGetCurrency = ({
    id,
    response,
    status = 200,
}: MockGetCurrencyParams): HttpHandler =>
    http.get(`*/v1/currencies/${id}`, () =>
        HttpResponse.json(response, { status }),
    )

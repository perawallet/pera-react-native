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
import type {
    CalculatePeraFeeApiResponse,
    CalculateSwapAmountApiResponse,
    CreateQuotesApiResponse,
} from './schema'

export type MockCalculatePeraFeeParams = {
    response: CalculatePeraFeeApiResponse
    status?: number
}

export const mockCalculatePeraFee = ({
    response,
    status = 200,
}: MockCalculatePeraFeeParams): HttpHandler =>
    http.post('*/v1/dex-swap/calculate-pera-fee/', () =>
        HttpResponse.json(response, { status }),
    )

export type MockCalculateSwapAmountParams = {
    response: CalculateSwapAmountApiResponse
    status?: number
}

export const mockCalculateSwapAmount = ({
    response,
    status = 200,
}: MockCalculateSwapAmountParams): HttpHandler =>
    http.post('*/v1/dex-swap/calculate-swap-amount/', () =>
        HttpResponse.json(response, { status }),
    )

export type MockCreateQuotesParams = {
    response: CreateQuotesApiResponse
    status?: number
}

export const mockCreateQuotes = ({
    response,
    status = 200,
}: MockCreateQuotesParams): HttpHandler =>
    http.post('*/v2/dex-swap/quotes/', () =>
        HttpResponse.json(response, { status }),
    )

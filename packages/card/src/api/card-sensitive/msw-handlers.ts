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
    cardSecureViewResponseSchema,
    cardSetPinSessionResponseSchema,
    type CardSecureViewApiResponse,
    type CardSetPinSessionApiResponse,
} from './schema'

export type MockCardSecureViewParams = {
    response: CardSecureViewApiResponse
    status?: number
}

export const mockCardDetailsToken = ({
    response,
    status = 200,
}: MockCardSecureViewParams): HttpHandler => {
    validateMockResponse(
        cardSecureViewResponseSchema,
        response,
        'mockCardDetailsToken',
    )
    return http.post('*/v1/card/details/token', () =>
        HttpResponse.json(response, { status }),
    )
}

export const mockCardPinToken = ({
    response,
    status = 200,
}: MockCardSecureViewParams): HttpHandler => {
    validateMockResponse(
        cardSecureViewResponseSchema,
        response,
        'mockCardPinToken',
    )
    return http.post('*/v1/card/pin/token', () =>
        HttpResponse.json(response, { status }),
    )
}

export type MockSetPinSessionParams = {
    response: CardSetPinSessionApiResponse
    status?: number
}

export const mockSetPinSession = ({
    response,
    status = 200,
}: MockSetPinSessionParams): HttpHandler => {
    validateMockResponse(
        cardSetPinSessionResponseSchema,
        response,
        'mockSetPinSession',
    )
    return http.post('*/v1/card/set-pin/token', () =>
        HttpResponse.json(response, { status }),
    )
}

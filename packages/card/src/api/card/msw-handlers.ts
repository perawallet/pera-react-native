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
import { cardStatusResponseSchema, type CardStatusApiResponse } from './schema'

export type MockGetCardStatusParams = {
    response: CardStatusApiResponse
    status?: number
}

export const mockGetCardStatus = ({
    response,
    status = 200,
}: MockGetCardStatusParams): HttpHandler => {
    validateMockResponse(
        cardStatusResponseSchema,
        response,
        'mockGetCardStatus',
    )
    return http.get('*/v1/card/status', () =>
        HttpResponse.json(response, { status }),
    )
}

export const mockOrderCard = (status = 200): HttpHandler =>
    http.post('*/v1/card/order', () =>
        HttpResponse.json({ success: true }, { status }),
    )

export const mockFreezeCard = (status = 200): HttpHandler =>
    http.post('*/v1/card/freeze', () =>
        HttpResponse.json({ success: true }, { status }),
    )

export const mockUnfreezeCard = (status = 200): HttpHandler =>
    http.post('*/v1/card/unfreeze', () =>
        HttpResponse.json({ success: true }, { status }),
    )

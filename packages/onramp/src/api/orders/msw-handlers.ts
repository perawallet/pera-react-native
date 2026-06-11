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
import {
    validateMockRequest,
    validateMockResponse,
} from '@perawallet/wallet-core-shared/test-utils'

import {
    cancelRampOrderRequestSchema,
    cancelRampOrderResponseSchema,
    createRampOrderRequestSchema,
    createRampOrderResponseSchema,
    type CancelRampOrderApiResponse,
    type RampOrderApiResponse,
} from './schema'

export type MockCreateRampOrderParams = {
    response: RampOrderApiResponse
    status?: number
}

export const mockCreateRampOrder = ({
    response,
    status = 200,
}: MockCreateRampOrderParams): HttpHandler => {
    validateMockResponse(
        createRampOrderResponseSchema,
        response,
        'mockCreateRampOrder',
    )
    return http.post('*/v1/ramp/orders/', async ({ request }) => {
        const validated = await validateMockRequest(
            createRampOrderRequestSchema,
            request,
        )
        if (!validated.ok) return validated.response
        return HttpResponse.json(response, { status })
    })
}

export type MockCancelRampOrderParams = {
    response: CancelRampOrderApiResponse
    status?: number
}

export const mockCancelRampOrder = ({
    response,
    status = 200,
}: MockCancelRampOrderParams): HttpHandler => {
    validateMockResponse(
        cancelRampOrderResponseSchema,
        response,
        'mockCancelRampOrder',
    )
    return http.post('*/v1/ramp/orders/cancel/', async ({ request }) => {
        const validated = await validateMockRequest(
            cancelRampOrderRequestSchema,
            request,
        )
        if (!validated.ok) return validated.response
        return HttpResponse.json(response, { status })
    })
}

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
import {
    validateMockRequest,
    validateMockResponse,
} from '@perawallet/wallet-core-shared/test-utils'
import { SWAP_ROUTER_PATH } from '@perawallet/wallet-core-swaps'

import type { RouterErrorBody } from '../../errors'
import {
    rampHistoryItemSchema,
    type RampHistoryItemInput,
} from '../history/schema'
import {
    cancelRampOrderRequestSchema,
    createRampOrderRequestSchema,
    createRampOrderResponseSchema,
    type RampOrderApiInput,
} from './schema'

export type MockCreateRampOrderParams = {
    response: RampOrderApiInput
    status?: number
}

export const mockCreateRampOrder = ({
    response,
    status = 201,
}: MockCreateRampOrderParams): HttpHandler => {
    validateMockResponse(
        createRampOrderResponseSchema,
        response,
        'mockCreateRampOrder',
    )
    return http.post(`*${SWAP_ROUTER_PATH}orders/`, async ({ request }) => {
        const validated = await validateMockRequest(
            createRampOrderRequestSchema,
            request,
        )
        if (!validated.ok) return validated.response
        return HttpResponse.json(response, { status })
    })
}

export type MockCancelRampOrderParams =
    | { response: RampHistoryItemInput; status?: 200 }
    | { response: RouterErrorBody; status: number }

export const mockCancelRampOrder = (
    params: MockCancelRampOrderParams,
): HttpHandler => {
    const status = params.status ?? 200
    if (status === 200) {
        validateMockResponse(
            rampHistoryItemSchema,
            params.response,
            'mockCancelRampOrder',
        )
    }
    return http.patch(
        `*${SWAP_ROUTER_PATH}orders/:orderId/`,
        async ({ request }) => {
            const validated = await validateMockRequest(
                cancelRampOrderRequestSchema,
                request,
            )
            if (!validated.ok) return validated.response
            return HttpResponse.json(params.response, { status })
        },
    )
}

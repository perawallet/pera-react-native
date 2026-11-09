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
import type { z } from 'zod'
import {
    validateMockRequest,
    validateMockResponse,
} from '@perawallet/wallet-core-shared/test-utils'
import type { SwapRouterErrorBody } from '../quotes/msw-handlers'
import { SWAP_ROUTER_PATH } from '../router-request'
import {
    createSwapOrderRequestSchema,
    createSwapOrderResponseSchema,
    reportSwapOrderRequestSchema,
    swapOrderItemSchema,
} from './schema'

export type MockCreateSwapOrderParams =
    | { response: z.input<typeof createSwapOrderResponseSchema>; status?: 201 }
    | { response: SwapRouterErrorBody; status: number }

export const mockCreateSwapOrder = (
    params: MockCreateSwapOrderParams,
): HttpHandler => {
    const status = params.status ?? 201
    if (status === 201) {
        validateMockResponse(
            createSwapOrderResponseSchema,
            params.response,
            'mockCreateSwapOrder',
        )
    }
    return http.post(`*${SWAP_ROUTER_PATH}orders/`, async ({ request }) => {
        const validated = await validateMockRequest(
            createSwapOrderRequestSchema,
            request,
        )
        if (!validated.ok) return validated.response
        return HttpResponse.json(params.response, { status })
    })
}

export type MockReportSwapOrderParams =
    | { response: z.input<typeof swapOrderItemSchema>; status?: 200 }
    | { response: SwapRouterErrorBody; status: number }

export const mockReportSwapOrder = (
    params: MockReportSwapOrderParams,
): HttpHandler => {
    const status = params.status ?? 200
    if (status === 200) {
        validateMockResponse(
            swapOrderItemSchema,
            params.response,
            'mockReportSwapOrder',
        )
    }
    return http.patch(
        `*${SWAP_ROUTER_PATH}orders/:orderId/`,
        async ({ request }) => {
            const validated = await validateMockRequest(
                reportSwapOrderRequestSchema,
                request,
            )
            if (!validated.ok) return validated.response
            return HttpResponse.json(params.response, { status })
        },
    )
}

export type MockFetchSwapOrderParams =
    | { order: z.input<typeof swapOrderItemSchema> }
    | { response: SwapRouterErrorBody; status: number }

export const mockFetchSwapOrder = (
    params: MockFetchSwapOrderParams,
): HttpHandler => {
    if ('order' in params) {
        validateMockResponse(
            swapOrderItemSchema,
            params.order,
            'mockFetchSwapOrder',
        )
    }
    return http.get(`*${SWAP_ROUTER_PATH}orders/:orderId/`, () =>
        'order' in params
            ? HttpResponse.json(params.order)
            : HttpResponse.json(params.response, { status: params.status }),
    )
}

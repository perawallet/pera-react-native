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
import { SWAP_ROUTER_PATH } from '../router-request'
import {
    createSwapQuotesRequestSchema,
    createSwapQuotesResponseSchema,
} from './schema'

export type SwapRouterErrorBody = { error: string; code?: string }

export type MockCreateSwapQuotesParams =
    | { response: z.input<typeof createSwapQuotesResponseSchema>; status?: 200 }
    | { response: SwapRouterErrorBody; status: number }

export const mockCreateSwapQuotes = (
    params: MockCreateSwapQuotesParams,
): HttpHandler => {
    if (params.status === undefined || params.status === 200) {
        validateMockResponse(
            createSwapQuotesResponseSchema,
            params.response,
            'mockCreateSwapQuotes',
        )
    }
    return http.post(`*${SWAP_ROUTER_PATH}quotes/`, async ({ request }) => {
        const validated = await validateMockRequest(
            createSwapQuotesRequestSchema,
            request,
        )
        if (!validated.ok) return validated.response
        return HttpResponse.json(params.response, {
            status: params.status ?? 200,
        })
    })
}

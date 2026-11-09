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
import { validateMockResponse } from '@perawallet/wallet-core-shared/test-utils'
import type { SwapRouterErrorBody } from '../quotes/msw-handlers'
import { SWAP_ROUTER_PATH } from '../router-request'
import { swapPairsQuerySchema, swapPairsResponseSchema } from './schema'

export type MockSwapPairsParams =
    | { response: z.input<typeof swapPairsResponseSchema>; status?: 200 }
    | { response: SwapRouterErrorBody; status: number }

export const mockSwapPairs = (params: MockSwapPairsParams): HttpHandler => {
    const status = params.status ?? 200
    if (status === 200) {
        validateMockResponse(
            swapPairsResponseSchema,
            params.response,
            'mockSwapPairs',
        )
    }
    return http.get(`*${SWAP_ROUTER_PATH}pairs/`, ({ request }) => {
        const query = swapPairsQuerySchema.safeParse(
            Object.fromEntries(new URL(request.url).searchParams),
        )
        if (!query.success) {
            return HttpResponse.json(
                { error: 'Invalid request', details: query.error.issues },
                { status: 422 },
            )
        }
        return HttpResponse.json(params.response, { status })
    })
}

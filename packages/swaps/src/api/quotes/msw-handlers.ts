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
import type { z } from 'zod'
import {
    validateMockRequest,
    validateMockResponse,
} from '@perawallet/wallet-core-shared/test-utils'
import {
    calculatePeraFeeRequestSchema,
    calculatePeraFeeResponseSchema,
    calculateSwapAmountRequestSchema,
    calculateSwapAmountResponseSchema,
    createQuotesRequestSchema,
    createQuotesResponseSchema,
} from './schema'

// Mock payloads are typed with the schema *input* (wire) shape — asset ids
// may be numbers on the wire but are normalized to strings during parsing.
export type MockCalculatePeraFeeParams = {
    response: z.input<typeof calculatePeraFeeResponseSchema>
    status?: number
}

export const mockCalculatePeraFee = ({
    response,
    status = 200,
}: MockCalculatePeraFeeParams): HttpHandler => {
    validateMockResponse(
        calculatePeraFeeResponseSchema,
        response,
        'mockCalculatePeraFee',
    )
    return http.post(
        '*/v1/dex-swap/calculate-pera-fee/',
        async ({ request }) => {
            const validated = await validateMockRequest(
                calculatePeraFeeRequestSchema,
                request,
            )
            if (!validated.ok) return validated.response
            return HttpResponse.json(response, { status })
        },
    )
}

export type MockCalculateSwapAmountParams = {
    response: z.input<typeof calculateSwapAmountResponseSchema>
    status?: number
}

export const mockCalculateSwapAmount = ({
    response,
    status = 200,
}: MockCalculateSwapAmountParams): HttpHandler => {
    validateMockResponse(
        calculateSwapAmountResponseSchema,
        response,
        'mockCalculateSwapAmount',
    )
    return http.post(
        '*/v1/dex-swap/calculate-swap-amount/',
        async ({ request }) => {
            const validated = await validateMockRequest(
                calculateSwapAmountRequestSchema,
                request,
            )
            if (!validated.ok) return validated.response
            return HttpResponse.json(response, { status })
        },
    )
}

export type MockCreateQuotesParams = {
    response: z.input<typeof createQuotesResponseSchema>
    status?: number
}

export const mockCreateQuotes = ({
    response,
    status = 200,
}: MockCreateQuotesParams): HttpHandler => {
    validateMockResponse(
        createQuotesResponseSchema,
        response,
        'mockCreateQuotes',
    )
    return http.post('*/v2/dex-swap/quotes/', async ({ request }) => {
        const validated = await validateMockRequest(
            createQuotesRequestSchema,
            request,
        )
        if (!validated.ok) return validated.response
        return HttpResponse.json(response, { status })
    })
}

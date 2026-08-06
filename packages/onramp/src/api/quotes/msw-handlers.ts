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

import {
    createRampQuoteRequestSchema,
    createRampQuoteResponseSchema,
    type CreateRampQuoteApiResponse,
} from './schema'

export type MockCreateRampQuoteParams = {
    response: CreateRampQuoteApiResponse
    status?: number
}

export const mockCreateRampQuote = ({
    response,
    status = 200,
}: MockCreateRampQuoteParams): HttpHandler => {
    validateMockResponse(
        createRampQuoteResponseSchema,
        response,
        'mockCreateRampQuote',
    )
    return http.post('*/v1/ramp/quotes/', async ({ request }) => {
        const validated = await validateMockRequest(
            createRampQuoteRequestSchema,
            request,
        )
        if (!validated.ok) return validated.response
        return HttpResponse.json(response, { status })
    })
}

export type MockCreateRampQuoteErrorParams = {
    /** Pera error envelope (e.g. SourceAmountIsTooLow); not the quotes schema. */
    response: Record<string, unknown>
    status?: number
}

// Error twin of mockCreateRampQuote: serves a Pera API error body, which the
// success-schema validation above would reject by design.
export const mockCreateRampQuoteError = ({
    response,
    status = 400,
}: MockCreateRampQuoteErrorParams): HttpHandler =>
    http.post('*/v1/ramp/quotes/', async ({ request }) => {
        const validated = await validateMockRequest(
            createRampQuoteRequestSchema,
            request,
        )
        if (!validated.ok) return validated.response
        return HttpResponse.json(response, { status })
    })

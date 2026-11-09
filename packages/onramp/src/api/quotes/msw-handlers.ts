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

import type { RouterErrorBody } from '../router-error'
import {
    createRampQuoteRequestSchema,
    createRampQuoteResponseSchema,
    type CreateRampQuoteApiInput,
} from './schema'

export type MockCreateRampQuoteParams = {
    response: CreateRampQuoteApiInput
    status?: number
}

const QUOTES_PATH = `*${SWAP_ROUTER_PATH}quotes/`

export const mockCreateRampQuote = ({
    response,
    status = 200,
}: MockCreateRampQuoteParams): HttpHandler => {
    validateMockResponse(
        createRampQuoteResponseSchema,
        response,
        'mockCreateRampQuote',
    )
    return http.post(QUOTES_PATH, async ({ request }) => {
        const validated = await validateMockRequest(
            createRampQuoteRequestSchema,
            request,
        )
        if (!validated.ok) return validated.response
        return HttpResponse.json(response, { status })
    })
}

export type MockCreateRampQuoteErrorParams = {
    /** The router's error body (e.g. `amount_too_low`); not the quotes schema. */
    response: RouterErrorBody
    status?: number
}

// Error twin of mockCreateRampQuote: serves a router error body, which the
// success-schema validation above would reject by design.
export const mockCreateRampQuoteError = ({
    response,
    status = 400,
}: MockCreateRampQuoteErrorParams): HttpHandler =>
    http.post(QUOTES_PATH, async ({ request }) => {
        const validated = await validateMockRequest(
            createRampQuoteRequestSchema,
            request,
        )
        if (!validated.ok) return validated.response
        return HttpResponse.json(response, { status })
    })

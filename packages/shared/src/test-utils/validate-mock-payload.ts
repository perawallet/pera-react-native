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

import type { z } from 'zod'

/**
 * Validate an MSW handler's response payload against the production zod
 * schema. Called at handler-registration time (i.e. inside the factory), so
 * a fixture that drifts from the API contract fails on the line that
 * constructed the handler — not later when the SUT receives weird data.
 *
 * Used by `**\/msw-handlers.ts` files across packages.
 *
 * @example
 *   export const mockListCurrencies = ({ response, status = 200 }) => {
 *       validateMockResponse(currenciesListResponseSchema, response, 'mockListCurrencies')
 *       return http.get('*\/v1/currencies/', () => HttpResponse.json(response, { status }))
 *   }
 */
export const validateMockResponse = <T extends z.ZodTypeAny>(
    schema: T,
    response: unknown,
    label: string,
): z.infer<T> => {
    const result = schema.safeParse(response)
    if (!result.success) {
        throw new Error(
            `${label}: mock response does not match the production zod schema.\n` +
                'If the API contract intentionally changed, update the schema ' +
                'AND this fixture together. Issues:\n' +
                JSON.stringify(result.error.issues, null, 2),
        )
    }
    return result.data
}

/**
 * Build an MSW request handler that validates the incoming request body
 * against the production zod schema before delegating to `onValid`. Returns
 * a 400 response with the ZodError if validation fails — gives test
 * authors immediate feedback when the SUT sends a malformed body.
 *
 * Pass `null` for endpoints without a request body (GET, DELETE).
 */
export const validateMockRequest = async <T extends z.ZodTypeAny>(
    schema: T | null,
    request: Request,
): Promise<
    { ok: true; data: z.infer<T> | null } | { ok: false; response: Response }
> => {
    if (!schema) return { ok: true, data: null }
    let body: unknown
    try {
        body = await request.json()
    } catch {
        body = undefined
    }
    const result = schema.safeParse(body)
    if (!result.success) {
        return {
            ok: false,
            response: Response.json(
                {
                    error: 'invalid_request_body',
                    issues: result.error.issues,
                },
                { status: 400 },
            ),
        }
    }
    return { ok: true, data: result.data }
}

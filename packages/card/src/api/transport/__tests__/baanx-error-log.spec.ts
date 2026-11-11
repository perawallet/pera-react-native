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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { HTTPError, TimeoutError, type BeforeErrorState } from 'ky'

const { logger } = vi.hoisted(() => ({
    logger: { error: vi.fn(), warn: vi.fn() },
}))

vi.mock('@perawallet/wallet-core-shared', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-shared')
    >()),
    logger,
}))

import { logBaanxRequestError } from '../baanx-error-log'

const URL_WITH_QUERY =
    'https://baanx.test/v1/auth/register/verification?email=user%40example.com'

const httpErrorState = (
    status: number,
    body: unknown,
    headers: Record<string, string> = {},
): BeforeErrorState => {
    const request = new Request(URL_WITH_QUERY, { method: 'POST' })
    const error = new HTTPError(
        new Response(JSON.stringify(body), { status, headers }),
        request,
        {} as never,
    )
    error.data = body
    return { request, error, options: {} as never, retryCount: 0 }
}

describe('logBaanxRequestError', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('reports a server failure with its path, status, correlation id and Baanx message', () => {
        const state = httpErrorState(
            502,
            { message: 'Bad gateway' },
            { 'x-correlation-id': 'cid-123' },
        )

        const returned = logBaanxRequestError(state)

        expect(returned).toBe(state.error)
        expect(logger.error).toHaveBeenCalledWith('Baanx request failed', {
            method: 'POST',
            path: '/v1/auth/register/verification',
            status: 502,
            correlationId: 'cid-123',
            baanxMessage: 'Bad gateway',
        })
        expect(logger.warn).not.toHaveBeenCalled()
    })

    it.each([400, 401, 404, 422])(
        'keeps a %i out of crash reporting, since the card flows answer with it',
        status => {
            const state = httpErrorState(
                status,
                { message: 'Invalid onboarding' },
                { 'x-correlation-id': 'cid-flow' },
            )

            logBaanxRequestError(state)

            expect(logger.error).not.toHaveBeenCalled()
            expect(logger.warn).toHaveBeenCalledWith(
                'Baanx request rejected',
                expect.objectContaining({ status, correlationId: 'cid-flow' }),
            )
        },
    )

    it('reports a 403 with its correlation id', () => {
        const state = httpErrorState(
            403,
            { message: 'Forbidden' },
            { 'x-correlation-id': 'cid-403' },
        )

        logBaanxRequestError(state)

        expect(logger.warn).not.toHaveBeenCalled()
        expect(logger.error).toHaveBeenCalledWith(
            'Baanx request failed',
            expect.objectContaining({
                status: 403,
                correlationId: 'cid-403',
                baanxMessage: 'Forbidden',
            }),
        )
    })

    it('never logs the query string, which can carry the user email', () => {
        logBaanxRequestError(httpErrorState(500, {}))

        const [, context] = logger.error.mock.calls[0]
        expect(JSON.stringify(context)).not.toContain('example.com')
    })

    it('drops a Baanx message that is not a string and caps a long one', () => {
        logBaanxRequestError(httpErrorState(500, { message: { nested: true } }))
        logBaanxRequestError(httpErrorState(500, { message: 'x'.repeat(500) }))

        expect(logger.error.mock.calls[0][1].baanxMessage).toBeUndefined()
        expect(logger.error.mock.calls[1][1].baanxMessage).toHaveLength(200)
    })

    it('warns on a timeout without reporting it', () => {
        const request = new Request(URL_WITH_QUERY, { method: 'GET' })
        const state: BeforeErrorState = {
            request,
            error: new TimeoutError(request),
            options: {} as never,
            retryCount: 0,
        }

        logBaanxRequestError(state)

        expect(logger.error).not.toHaveBeenCalled()
        expect(logger.warn).toHaveBeenCalledWith(
            'Baanx request did not complete',
            expect.objectContaining({
                method: 'GET',
                path: '/v1/auth/register/verification',
            }),
        )
    })

    it('stays silent for an aborted request', () => {
        const request = new Request(URL_WITH_QUERY)
        const error = new Error('aborted')
        error.name = 'AbortError'

        logBaanxRequestError({
            request,
            error,
            options: {} as never,
            retryCount: 0,
        })

        expect(logger.error).not.toHaveBeenCalled()
        expect(logger.warn).not.toHaveBeenCalled()
    })
})

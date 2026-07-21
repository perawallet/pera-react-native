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

import { describe, expect, it } from 'vitest'
import { HTTPError, NetworkError, TimeoutError } from 'ky'
import { AppError, ErrorCategory } from '../base'
import {
    PeraNetworkError,
    getNetworkErrorMessageKeys,
    isNotFoundError,
    isPeraNetworkError,
} from '../network'

// Minimal ky HTTPError builder — ky's isHTTPError checks `instanceof HTTPError`.
const makeHttpError = (status: number): HTTPError => {
    const response = { status } as Response
    const request = {} as Request
    return new HTTPError(response, request, {} as never)
}

// ky's isNetworkError checks `instanceof NetworkError` (this ky version wraps
// fetch/DNS/connection failures in its own `NetworkError` class before the
// request layer sees them — a bare fetch `TypeError` does not satisfy the
// predicate here, since `isErrorType` matches on `instanceof` or `name`).
const makeNetworkError = (): NetworkError => new NetworkError({} as Request)

// ky's isTimeoutError checks `instanceof TimeoutError`.
const makeTimeoutError = (): TimeoutError => new TimeoutError({} as Request)

// Same HTTPError shape as makeHttpError, but with a real Response carrying a
// body so `.clone().json()` (or `.text()`) resolves against real content.
const makeHttpErrorWithBody = (status: number, body: unknown): HTTPError => {
    const response = new Response(JSON.stringify(body), { status })
    const request = {} as Request
    return new HTTPError(response as never, request, {} as never)
}

describe('PeraNetworkError.fromKyError', () => {
    it('classifies a fetch network TypeError as offline (retryable)', () => {
        const err = PeraNetworkError.fromKyError(makeNetworkError())
        expect(err.kind).toBe('offline')
        expect(err.metadata.retryable).toBe(true)
        expect(err.metadata.category).toBe(ErrorCategory.NETWORK)
    })

    it('classifies a TimeoutError as timeout (retryable)', () => {
        const err = PeraNetworkError.fromKyError(makeTimeoutError())
        expect(err.kind).toBe('timeout')
        expect(err.metadata.retryable).toBe(true)
    })

    it('classifies HTTP 404 as client with status preserved (not retryable)', () => {
        const err = PeraNetworkError.fromKyError(makeHttpError(404))
        expect(err.kind).toBe('client')
        expect(err.status).toBe(404)
        expect(err.metadata.retryable).toBe(false)
    })

    it('classifies HTTP 429 as client with status preserved', () => {
        const err = PeraNetworkError.fromKyError(makeHttpError(429))
        expect(err.kind).toBe('client')
        expect(err.status).toBe(429)
    })

    it('classifies HTTP 500 as server with status preserved (retryable)', () => {
        const err = PeraNetworkError.fromKyError(makeHttpError(500))
        expect(err.kind).toBe('server')
        expect(err.status).toBe(500)
        expect(err.metadata.retryable).toBe(true)
    })

    it('classifies an arbitrary throwable as unknown (not retryable)', () => {
        const err = PeraNetworkError.fromKyError(new Error('boom'))
        expect(err.kind).toBe('unknown')
        expect(err.metadata.retryable).toBe(false)
    })

    it('is idempotent for an existing PeraNetworkError', () => {
        const original = PeraNetworkError.fromKyError(makeHttpError(404))
        expect(PeraNetworkError.fromKyError(original)).toBe(original)
    })

    it('preserves the original error and is an AppError instance', () => {
        const cause = makeHttpError(500)
        const err = PeraNetworkError.fromKyError(cause)
        expect(err.originalError).toBe(cause)
        expect(err instanceof AppError).toBe(true)
        expect(err instanceof Error).toBe(true)
    })

    it('isPeraNetworkError narrows correctly', () => {
        expect(
            isPeraNetworkError(
                PeraNetworkError.fromKyError(makeHttpError(404)),
            ),
        ).toBe(true)
        expect(isPeraNetworkError(new Error('x'))).toBe(false)
    })
})

describe('PeraNetworkError.fromKyErrorWithBody', () => {
    it('extracts the backend error type from the response body', async () => {
        const error = await PeraNetworkError.fromKyErrorWithBody(
            makeHttpErrorWithBody(400, { type: 'device_already_exists' }),
        )
        expect(error.kind).toBe('client')
        expect(error.status).toBe(400)
        expect(error.backendType).toBe('device_already_exists')
    })

    it('tolerates a non-JSON body', async () => {
        const response = new Response('nope', { status: 500 })
        const request = {} as Request
        const error = new HTTPError(response as never, request, {} as never)
        const result = await PeraNetworkError.fromKyErrorWithBody(error)
        expect(result.kind).toBe('server')
        expect(result.backendType).toBeUndefined()
    })

    it('leaves backendType unset for a JSON body without a type field', async () => {
        const error = await PeraNetworkError.fromKyErrorWithBody(
            makeHttpErrorWithBody(400, { message: 'bad request' }),
        )
        expect(error.kind).toBe('client')
        expect(error.backendType).toBeUndefined()
    })

    it('leaves backendType unset for a non-string type field', async () => {
        const error = await PeraNetworkError.fromKyErrorWithBody(
            makeHttpErrorWithBody(400, { type: 42 }),
        )
        expect(error.kind).toBe('client')
        expect(error.backendType).toBeUndefined()
    })
})

describe('getNetworkErrorMessageKeys', () => {
    const keysFor = (base: string) => ({
        titleKey: `${base}.title`,
        bodyKey: `${base}.body`,
    })

    it('maps offline → errors.network.no_connection', () => {
        expect(
            getNetworkErrorMessageKeys(new PeraNetworkError('offline')),
        ).toEqual(keysFor('errors.network.no_connection'))
    })

    it('maps timeout → errors.network.timeout', () => {
        expect(
            getNetworkErrorMessageKeys(new PeraNetworkError('timeout')),
        ).toEqual(keysFor('errors.network.timeout'))
    })

    it('maps server → errors.api.server_error', () => {
        expect(
            getNetworkErrorMessageKeys(
                new PeraNetworkError('server', { status: 500 }),
            ),
        ).toEqual(keysFor('errors.api.server_error'))
    })

    it('maps client 404 → errors.api.not_found', () => {
        expect(
            getNetworkErrorMessageKeys(
                new PeraNetworkError('client', { status: 404 }),
            ),
        ).toEqual(keysFor('errors.api.not_found'))
    })

    it('maps client 401 and 403 → errors.api.unauthorized', () => {
        expect(
            getNetworkErrorMessageKeys(
                new PeraNetworkError('client', { status: 401 }),
            ),
        ).toEqual(keysFor('errors.api.unauthorized'))
        expect(
            getNetworkErrorMessageKeys(
                new PeraNetworkError('client', { status: 403 }),
            ),
        ).toEqual(keysFor('errors.api.unauthorized'))
    })

    it('maps other client statuses → errors.api.generic', () => {
        expect(
            getNetworkErrorMessageKeys(
                new PeraNetworkError('client', { status: 400 }),
            ),
        ).toEqual(keysFor('errors.api.generic'))
    })

    it('maps unknown kind and non-PeraNetworkError → errors.general', () => {
        expect(
            getNetworkErrorMessageKeys(new PeraNetworkError('unknown')),
        ).toEqual(keysFor('errors.general'))
        expect(getNetworkErrorMessageKeys(new Error('x'))).toEqual(
            keysFor('errors.general'),
        )
    })
})

describe('isNotFoundError', () => {
    it('is true for a PeraNetworkError with status 404', () => {
        expect(
            isNotFoundError(new PeraNetworkError('client', { status: 404 })),
        ).toBe(true)
    })

    it('is false for other PeraNetworkError statuses', () => {
        expect(
            isNotFoundError(new PeraNetworkError('client', { status: 400 })),
        ).toBe(false)
    })

    it('falls back to structural .response.status for raw errors', () => {
        expect(isNotFoundError({ response: { status: 404 } })).toBe(true)
        expect(isNotFoundError({ response: { status: 500 } })).toBe(false)
        expect(isNotFoundError(null)).toBe(false)
    })
})

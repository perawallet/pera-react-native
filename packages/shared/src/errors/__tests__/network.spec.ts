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

import { describe, expect, it } from 'vitest'
import { HTTPError, NetworkError, TimeoutError } from 'ky'
import { AppError, ErrorCategory } from '../base'
import { PeraNetworkError, isPeraNetworkError } from '../network'

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

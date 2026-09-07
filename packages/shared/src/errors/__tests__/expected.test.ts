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

import { describe, test, expect } from 'vitest'
import { AppError, ErrorCategory, ErrorSeverity } from '../base'
import { isExpectedError } from '../expected'

const appErrorWith = (expected?: boolean) =>
    new AppError('boom', {
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.NETWORK,
        expected,
    })

describe('isExpectedError', () => {
    test('is true for an AppError explicitly flagged expected', () => {
        expect(isExpectedError(appErrorWith(true))).toBe(true)
    })

    test('is false for an AppError with no flag', () => {
        expect(isExpectedError(appErrorWith())).toBe(false)
    })

    test('is false for an AppError flagged false', () => {
        expect(isExpectedError(appErrorWith(false))).toBe(false)
    })

    test.each(['TimeoutError', 'AbortError'])('is true for a raw %s', name => {
        const error = new Error('aborted')
        error.name = name
        expect(isExpectedError(error)).toBe(true)
    })

    test.each([
        'fetch failed',
        'Network request failed',
        'Unable to resolve host "example.com"',
        'java.net.UnknownHostException: example.com',
    ])('is true for the platform network message %s', message => {
        expect(isExpectedError(new Error(message))).toBe(true)
    })

    test.each([500, 502, 503, 429])(
        'is true for an error carrying response status %i',
        status => {
            expect(isExpectedError({ response: { status } })).toBe(true)
        },
    )

    test.each([400, 401, 404, 422])(
        'is false for an error carrying response status %i',
        status => {
            expect(isExpectedError({ response: { status } })).toBe(false)
        },
    )

    test('is false for a plain error', () => {
        expect(isExpectedError(new Error('something broke'))).toBe(false)
    })

    test('is false for null and undefined', () => {
        expect(isExpectedError(null)).toBe(false)
        expect(isExpectedError(undefined)).toBe(false)
    })

    test('does not throw on an Error with a throwing name accessor', () => {
        // Must be a real Error: a plain object short-circuits at the
        // `instanceof Error` check and never reaches the guarded read.
        const hostile = new Error('hostile')
        Object.defineProperty(hostile, 'name', {
            get() {
                throw new Error('boom')
            },
        })
        expect(() => isExpectedError(hostile)).not.toThrow()
        expect(isExpectedError(hostile)).toBe(false)
    })
})

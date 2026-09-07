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
import { PeraNetworkError } from '../../errors/network'
import { getHttpStatus, toError, assertDefined } from '../errors'

describe('getHttpStatus', () => {
    test('returns the status from a ky-style error object', () => {
        const error = { response: { status: 404 } }
        expect(getHttpStatus(error)).toBe(404)
    })

    test('returns undefined for primitives or null', () => {
        expect(getHttpStatus(null)).toBeUndefined()
        expect(getHttpStatus('oops')).toBeUndefined()
        expect(getHttpStatus(42)).toBeUndefined()
    })

    test('returns undefined when the response lacks a numeric status', () => {
        expect(getHttpStatus({ response: {} })).toBeUndefined()
        expect(getHttpStatus({ response: { status: '200' } })).toBeUndefined()
    })

    // The query client throws PeraNetworkError, which carries the status flat
    // and has no `response` at all — so reading only `response.status` made
    // this helper blind to every error the app actually produces.
    test('returns the status from a PeraNetworkError, which carries it flat', () => {
        expect(
            getHttpStatus(new PeraNetworkError('client', { status: 404 })),
        ).toBe(404)
        expect(
            getHttpStatus(new PeraNetworkError('server', { status: 500 })),
        ).toBe(500)
    })

    test('returns undefined for a PeraNetworkError with no status', () => {
        expect(getHttpStatus(new PeraNetworkError('offline'))).toBeUndefined()
    })

    test('returns undefined when a flat status is not numeric', () => {
        expect(getHttpStatus({ status: '404' })).toBeUndefined()
    })
})

describe('toError', () => {
    test('returns the same Error when given one', () => {
        const original = new TypeError('boom')
        expect(toError(original)).toBe(original)
    })

    test('wraps non-Error values in a new Error with stringified message', () => {
        expect(toError('oops').message).toBe('oops')
        expect(toError(42).message).toBe('42')
        expect(toError({ a: 1 }).message).toBe('[object Object]')
    })
})

describe('assertDefined', () => {
    test('returns the value when defined', () => {
        expect(assertDefined('x', 'name')).toBe('x')
        expect(assertDefined(0, 'zero')).toBe(0)
        expect(assertDefined(false, 'bool')).toBe(false)
    })

    test('throws a descriptive error for null or undefined', () => {
        expect(() => assertDefined(null, 'thing')).toThrow(
            'expected thing to be defined',
        )
        expect(() => assertDefined(undefined, 'other')).toThrow(
            'expected other to be defined',
        )
    })
})

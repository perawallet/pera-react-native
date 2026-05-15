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

import { describe, it, expect } from 'vitest'
import { HTTPError, TimeoutError } from 'ky'
import { isTransientNetworkError } from '../query-client'

const makeHttpError = (status: number): HTTPError => {
    const response = new Response(null, { status })
    const request = new Request('https://example.test/')
    return new HTTPError(response, request, {} as never)
}

const makeTimeoutError = (): TimeoutError => {
    const request = new Request('https://example.test/')
    return new TimeoutError(request)
}

describe('isTransientNetworkError', () => {
    it('returns true for ky TimeoutError', () => {
        expect(isTransientNetworkError(makeTimeoutError())).toBe(true)
    })

    it('returns true for HTTPError 500/502/503/504', () => {
        for (const status of [500, 502, 503, 504]) {
            expect(isTransientNetworkError(makeHttpError(status))).toBe(true)
        }
    })

    it('returns false for HTTPError 4xx', () => {
        for (const status of [400, 401, 403, 404, 422]) {
            expect(isTransientNetworkError(makeHttpError(status))).toBe(false)
        }
    })

    it('returns false for plain Error / unknown', () => {
        expect(isTransientNetworkError(new Error('boom'))).toBe(false)
        expect(isTransientNetworkError('not an error')).toBe(false)
        expect(isTransientNetworkError(undefined)).toBe(false)
    })
})

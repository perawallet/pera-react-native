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
import {
    parseReference,
    isArc0027Request,
    buildResponse,
    buildErrorResponse,
} from '../arc0027-codec'
import { ARC0027_ERROR_CODES } from '../arc0027-types'

const discoverRequest = {
    id: 'req-1',
    reference: 'arc0027:discover:request' as const,
}

describe('parseReference', () => {
    it('splits a valid reference into method and type', () => {
        expect(parseReference('arc0027:enable:request')).toEqual({
            method: 'enable',
            type: 'request',
        })
    })

    it('returns null for a foreign namespace or unknown method', () => {
        expect(parseReference('walletconnect:enable:request')).toBeNull()
        expect(parseReference('arc0027:teleport:request')).toBeNull()
        expect(parseReference('arc0027:enable')).toBeNull()
    })
})

describe('isArc0027Request', () => {
    it('accepts a well-formed request envelope', () => {
        expect(isArc0027Request(discoverRequest)).toBe(true)
    })

    it('rejects non-objects, missing id, response references, and unknown methods', () => {
        expect(isArc0027Request(null)).toBe(false)
        expect(isArc0027Request({ reference: 'arc0027:enable:request' })).toBe(
            false,
        )
        expect(
            isArc0027Request({ id: 'x', reference: 'arc0027:enable:response' }),
        ).toBe(false)
        expect(
            isArc0027Request({ id: 'x', reference: 'arc0027:nope:request' }),
        ).toBe(false)
    })

    it('rejects a non-string reference', () => {
        expect(isArc0027Request({ id: 'x', reference: 123 })).toBe(false)
    })
})

describe('buildResponse / buildErrorResponse', () => {
    it('echoes id as requestId, flips the reference to :response, and carries the result', () => {
        const res = buildResponse(discoverRequest, { providerId: 'pera' })
        expect(res).toEqual({
            id: expect.any(String),
            requestId: 'req-1',
            reference: 'arc0027:discover:response',
            result: { providerId: 'pera' },
        })
        expect(res.id).not.toBe('req-1') // fresh response id, not the request id
    })

    it('builds a canceled-error response', () => {
        const res = buildErrorResponse(discoverRequest, {
            code: ARC0027_ERROR_CODES.MethodCanceledError,
            message: 'User canceled',
        })
        expect(res.reference).toBe('arc0027:discover:response')
        expect(res.requestId).toBe('req-1')
        expect(res.error).toEqual({ code: 4001, message: 'User canceled' })
        expect(res.result).toBeUndefined()
    })
})

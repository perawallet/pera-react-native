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
    parseEnvelope,
    parseReference,
    buildResponse,
    buildErrorResponse,
    encodeFrame,
    decodeFrame,
} from '../arc0027/codec'
import { Arc0027Error } from '../arc0027/errors'
import { ARC0027_ERROR_CODES } from '../arc0027/types'

describe('ARC-0027 codec', () => {
    it('round-trips a request envelope through the base64(CBOR) wire frame', () => {
        const raw = encodeFrame({
            id: 'abc',
            reference: 'arc0027:sign_transactions:request',
            params: { providerId: 'p', txns: ['AQID'] },
        })
        const env = parseEnvelope(raw)
        expect(env.id).toBe('abc')
        expect((env.params as { txns: string[] }).txns).toEqual(['AQID'])
        expect(parseReference(env.reference)).toEqual({
            method: 'sign_transactions',
            type: 'request',
        })
    })

    it('rejects an unparseable frame with InvalidInputError', () => {
        expect(() => parseEnvelope('not-cbor-base64!!')).toThrow(Arc0027Error)
    })

    it('rejects a frame missing id/reference', () => {
        expect(() => parseEnvelope(encodeFrame({ nope: true }))).toThrow(
            Arc0027Error,
        )
    })

    it('rejects a non-arc0027 reference', () => {
        const raw = encodeFrame({ id: 'x', reference: 'foo:bar:request' })
        expect(() => parseEnvelope(raw)).toThrow(Arc0027Error)
    })

    it('builds a success response echoing requestId', () => {
        const out = decodeFrame(
            buildResponse('req-1', 'enable', { accounts: ['A'] }),
        ) as Record<string, unknown>
        expect(out).toMatchObject({
            reference: 'arc0027:enable:response',
            requestId: 'req-1',
            result: { accounts: ['A'] },
        })
        expect(typeof out.id).toBe('string')
    })

    it('builds an error response from an Arc0027Error', () => {
        const out = decodeFrame(
            buildErrorResponse(
                'req-2',
                'enable',
                new Arc0027Error(
                    ARC0027_ERROR_CODES.MethodCanceledError,
                    'user rejected',
                ),
            ),
        ) as { error: { code: number; message: string }; requestId: string }
        expect(out.error).toMatchObject({
            code: 4001,
            message: 'user rejected',
        })
        expect(out.requestId).toBe('req-2')
    })
})

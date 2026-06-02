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
import { parseOffer, buildSelect, buildSelectError } from '../frames'
import { NegotiationError } from '../errors'
import { NEGOTIATION_ERROR_CODES } from '../types'

const offerRaw = JSON.stringify({
    id: 'o1',
    reference: 'liquidauth:negotiate:offer',
    params: {
        handshakeVersion: 1,
        liquidAuthVersion: '1.0',
        protocols: [{ id: 'arc0027', versions: ['1.0'] }],
        peer: { name: 'Tinyman', origin: 'https://app.tinyman.org' },
    },
})

describe('negotiation frames', () => {
    it('parses an offer envelope', () => {
        const offer = parseOffer(offerRaw)
        expect(offer).toMatchObject({
            id: 'o1',
            handshakeVersion: 1,
            protocols: [{ id: 'arc0027', versions: ['1.0'] }],
            peer: { name: 'Tinyman', origin: 'https://app.tinyman.org' },
        })
    })

    it('throws MalformedOfferError on missing id', () => {
        const raw = JSON.stringify({
            reference: 'liquidauth:negotiate:offer',
            params: { handshakeVersion: 1, protocols: [] },
        })
        expect(() => parseOffer(raw)).toThrow(NegotiationError)
    })

    it('throws MalformedOfferError when protocols is not an array', () => {
        const raw = JSON.stringify({
            id: 'x',
            reference: 'liquidauth:negotiate:offer',
            params: { handshakeVersion: 1, protocols: 'nope' },
        })
        try {
            parseOffer(raw)
            expect.unreachable()
        } catch (error) {
            expect((error as NegotiationError).code).toBe(
                NEGOTIATION_ERROR_CODES.MalformedOfferError,
            )
        }
    })

    it('builds a success select echoing the requestId', () => {
        const out = JSON.parse(
            buildSelect('o1', { id: 'arc0027', version: '1.0' }),
        )
        expect(out).toMatchObject({
            reference: 'liquidauth:negotiate:select',
            requestId: 'o1',
            result: {
                handshakeVersion: 1,
                protocol: { id: 'arc0027', version: '1.0' },
            },
        })
        expect(typeof out.id).toBe('string')
    })

    it('builds an error select carrying code, message and data', () => {
        const out = JSON.parse(
            buildSelectError(
                'o2',
                NEGOTIATION_ERROR_CODES.NoCommonProtocolError,
                'no overlap',
                {
                    supported: [1],
                },
            ),
        )
        expect(out).toMatchObject({
            reference: 'liquidauth:negotiate:select',
            requestId: 'o2',
            error: {
                code: 5000,
                message: 'no overlap',
                data: { supported: [1] },
            },
        })
    })
})

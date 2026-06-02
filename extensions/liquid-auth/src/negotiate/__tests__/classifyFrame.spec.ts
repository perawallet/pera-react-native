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
import { classifyFrame } from '../classifyFrame'

const frame = (reference: string) => JSON.stringify({ id: 'x', reference })

describe('classifyFrame', () => {
    it('identifies a negotiate offer', () => {
        expect(classifyFrame(frame('liquidauth:negotiate:offer'))).toBe(
            'negotiate-offer',
        )
    })

    it('treats a JSON frame carrying an arc0027 reference as unknown', () => {
        // Real arc0027 frames are base64(CBOR), never JSON — a JSON frame is
        // only ever a negotiation frame, so an arc0027 reference in JSON must
        // not lock the dialect on an undecodable frame.
        expect(classifyFrame(frame('arc0027:discover:request'))).toBe('unknown')
        expect(classifyFrame(frame('arc0027:enable:response'))).toBe('unknown')
    })

    it('treats empty / heartbeat frames as unknown', () => {
        expect(classifyFrame('')).toBe('unknown')
        expect(classifyFrame('   ')).toBe('unknown')
    })

    it('treats malformed JSON as unknown', () => {
        expect(classifyFrame('{not json')).toBe('unknown')
    })

    it('treats a non-empty non-JSON frame as an arc0027 (base64 CBOR) request', () => {
        // base64(CBOR) text never starts with `{`
        expect(classifyFrame('omJpZAFkbmFtZQ==')).toBe('arc0027-request')
    })
})

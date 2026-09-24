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
import { decodeWireValues, encodeWireValues } from '../protocol'

describe('wire value encoding', () => {
    it('passes JSON-safe primitives through untouched', () => {
        const values = ['a', 1, 1.5, null, true]
        expect(encodeWireValues(values)).toEqual(values)
        expect(decodeWireValues(values)).toEqual(values)
    })

    it('round-trips Uint8Array as tagged base64', () => {
        const bytes = new Uint8Array([0, 1, 254, 255])
        const [encoded] = encodeWireValues([bytes])
        expect(encoded).toEqual({ __pera_u8: expect.any(String) })
        expect(JSON.parse(JSON.stringify(encoded))).toEqual(encoded)
        const [decoded] = decodeWireValues([encoded])
        expect(decoded).toEqual(bytes)
    })

    it('round-trips bigint as tagged string', () => {
        const [encoded] = encodeWireValues([123456789012345678901234n])
        expect(JSON.parse(JSON.stringify(encoded))).toEqual(encoded)
        expect(decodeWireValues([encoded])).toEqual([123456789012345678901234n])
    })

    it('maps undefined to null (SQL NULL)', () => {
        expect(encodeWireValues([undefined])).toEqual([null])
    })
})

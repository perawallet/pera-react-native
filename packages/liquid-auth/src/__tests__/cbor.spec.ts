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
import { cborDecode, cborEncode } from '../arc0027/cbor'

describe('cbor codec', () => {
    it('round-trips the ARC-0027 envelope shape', () => {
        const value = {
            id: '019e827a-59e7-766c-beb6-8073ec1b4149',
            reference: 'arc0027:sign_transactions:request',
            params: {
                providerId: 'pera',
                txns: [{ txn: 'AQIDBA==' }],
            },
        }
        expect(cborDecode(cborEncode(value))).toEqual(value)
    })

    it('round-trips primitives, arrays, bytes, booleans and null', () => {
        const value = {
            n: 42,
            neg: -7,
            big: 1_000_000,
            s: 'hello',
            arr: [1, 'two', true, null],
            bytes: new Uint8Array([1, 2, 3]),
            flag: false,
        }
        const decoded = cborDecode(cborEncode(value)) as typeof value
        expect(decoded.n).toBe(42)
        expect(decoded.neg).toBe(-7)
        expect(decoded.big).toBe(1_000_000)
        expect(decoded.s).toBe('hello')
        expect(decoded.arr).toEqual([1, 'two', true, null])
        expect(Array.from(decoded.bytes)).toEqual([1, 2, 3])
        expect(decoded.flag).toBe(false)
    })

    it('omits undefined-valued keys (JSON.stringify parity)', () => {
        const decoded = cborDecode(
            cborEncode({ a: 1, b: undefined }),
        ) as Record<string, unknown>
        expect(decoded).toEqual({ a: 1 })
    })

    it('decodes the wire markers observed on-device (CBOR, not JSON)', () => {
        // 0xB9 0x00 0x03 = map(3) with a 2-byte count; 0x62 = text("id");
        // 0x78 0x02 = text len 2. Mirrors the real data-channel frame prefix.
        const bytes = new Uint8Array([
            0xb9,
            0x00,
            0x01, // map(1)
            0x62,
            0x69,
            0x64, // "id"
            0x78,
            0x02,
            0x68,
            0x69, // text(2) "hi"
        ])
        expect(cborDecode(bytes)).toEqual({ id: 'hi' })
    })
})

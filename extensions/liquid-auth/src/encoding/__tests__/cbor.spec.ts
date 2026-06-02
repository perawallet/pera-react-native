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
import { cborDecode, cborEncode, cborEncodeMap, cborRaw } from '../cbor'

const hex = (bytes: Uint8Array): string =>
    Array.from(bytes)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')

describe('cborEncode integers', () => {
    it('encodes 0 as 0x00', () => {
        expect(Array.from(cborEncode(0))).toEqual([0x00])
    })

    it('encodes 23 as 0x17 (max single-byte)', () => {
        expect(Array.from(cborEncode(23))).toEqual([0x17])
    })

    it('encodes 24 as 0x18 0x18 (1-byte length prefix)', () => {
        expect(Array.from(cborEncode(24))).toEqual([0x18, 0x18])
    })

    it('encodes 256 as 0x19 0x01 0x00 (2-byte length prefix)', () => {
        expect(Array.from(cborEncode(256))).toEqual([0x19, 0x01, 0x00])
    })

    it('encodes 65536 with a 4-byte length prefix', () => {
        expect(Array.from(cborEncode(65536))).toEqual([
            0x1a, 0x00, 0x01, 0x00, 0x00,
        ])
    })

    it('encodes -7 (ES256 alg) as 0x26', () => {
        expect(Array.from(cborEncode(-7))).toEqual([0x26])
    })

    it('encodes -25 as 0x38 0x18', () => {
        expect(Array.from(cborEncode(-25))).toEqual([0x38, 0x18])
    })

    it('throws on non-integer numbers', () => {
        expect(() => cborEncode(1.5)).toThrow()
    })
})

describe('cborEncode byte and text strings', () => {
    it('encodes a 4-byte string with a 0x44 head', () => {
        const result = cborEncode(new Uint8Array([0xde, 0xad, 0xbe, 0xef]))
        expect(Array.from(result)).toEqual([0x44, 0xde, 0xad, 0xbe, 0xef])
    })

    it('uses a 2-byte length prefix at length 256 (0x59)', () => {
        const result = cborEncode(new Uint8Array(256))
        expect(Array.from(result.slice(0, 3))).toEqual([0x59, 0x01, 0x00])
        expect(result.length).toBe(259)
    })

    it('encodes "none" with a 0x64 head', () => {
        expect(Array.from(cborEncode('none'))).toEqual([
            0x64, 0x6e, 0x6f, 0x6e, 0x65,
        ])
    })
})

describe('cborEncode arrays and plain objects', () => {
    it('encodes [1, 2, 3] as 0x83 0x01 0x02 0x03', () => {
        expect(Array.from(cborEncode([1, 2, 3]))).toEqual([
            0x83, 0x01, 0x02, 0x03,
        ])
    })

    it('encodes nested arrays as arrays, never maps', () => {
        // With explicit cborEncodeMap for ordered maps there is no 2-tuple
        // heuristic: an array of pairs is an array of arrays on the wire.
        expect(hex(cborEncode([[1, 2]]))).toBe('81820102')
    })

    it('encodes a plain object as a string-keyed map', () => {
        expect(hex(cborEncode({ fmt: 'none' }))).toBe('a163666d74646e6f6e65')
    })
})

describe('cborEncodeMap (ordered, typed keys)', () => {
    it('encodes integer-keyed entries preserving the given order', () => {
        const result = cborEncodeMap([
            [3, 1],
            [1, 2],
        ])
        expect(Array.from(result)).toEqual([0xa2, 0x03, 0x01, 0x01, 0x02])
    })

    it('encodes negative integer keys (COSE labels)', () => {
        const result = cborEncodeMap([
            [1, 2],
            [3, -7],
        ])
        expect(Array.from(result)).toEqual([0xa2, 0x01, 0x02, 0x03, 0x26])
    })

    it('encodes the empty map as 0xa0', () => {
        expect(Array.from(cborEncodeMap([]))).toEqual([0xa0])
    })

    it('embeds cborRaw bytes verbatim', () => {
        const result = cborEncodeMap([['attStmt', cborRaw(cborEncodeMap([]))]])
        // a1 (map(1)) 67 "attStmt" a0 (map(0))
        expect(hex(result)).toBe('a16761747453746d74a0')
    })
})

describe('cborEncode/cborDecode round-trips (ARC-0027 transport)', () => {
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
        // 0xB9 0x00 0x01 = map(1) with a 2-byte count; 0x62 = text("id");
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

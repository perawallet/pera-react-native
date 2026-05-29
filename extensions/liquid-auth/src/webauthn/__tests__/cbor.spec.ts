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

import { cborEncode, cborEncodeMap } from '../cbor'

const hex = (bytes: Uint8Array): string =>
    Array.from(bytes)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')

describe('cborEncode unsigned integers', () => {
    it('encodes 0 as 0x00', () => {
        expect(Array.from(cborEncode(0))).toEqual([0x00])
    })

    it('encodes 23 as 0x17 (max single-byte)', () => {
        expect(Array.from(cborEncode(23))).toEqual([0x17])
    })

    it('encodes 24 as 0x18 0x18 (1-byte length prefix)', () => {
        expect(Array.from(cborEncode(24))).toEqual([0x18, 0x18])
    })

    it('encodes 255 as 0x18 0xff', () => {
        expect(Array.from(cborEncode(255))).toEqual([0x18, 0xff])
    })

    it('encodes 256 as 0x19 0x01 0x00 (2-byte length prefix)', () => {
        expect(Array.from(cborEncode(256))).toEqual([0x19, 0x01, 0x00])
    })

    it('encodes 65535 as 0x19 0xff 0xff', () => {
        expect(Array.from(cborEncode(65535))).toEqual([0x19, 0xff, 0xff])
    })

    it('encodes 65536 as 0x1a (4-byte length prefix)', () => {
        expect(Array.from(cborEncode(65536))).toEqual([
            0x1a, 0x00, 0x01, 0x00, 0x00,
        ])
    })
})

describe('cborEncode negative integers', () => {
    it('encodes -7 (ES256 alg) as 0x26', () => {
        expect(Array.from(cborEncode(-7))).toEqual([0x26])
    })

    it('encodes -1 as 0x20', () => {
        expect(Array.from(cborEncode(-1))).toEqual([0x20])
    })

    it('encodes -24 as 0x37 (max single-byte negative)', () => {
        expect(Array.from(cborEncode(-24))).toEqual([0x37])
    })

    it('encodes -25 as 0x38 0x18', () => {
        expect(Array.from(cborEncode(-25))).toEqual([0x38, 0x18])
    })
})

describe('cborEncode byte strings', () => {
    it('encodes a 4-byte string with a 0x44 head', () => {
        const result = cborEncode(new Uint8Array([0xde, 0xad, 0xbe, 0xef]))
        expect(Array.from(result)).toEqual([0x44, 0xde, 0xad, 0xbe, 0xef])
    })

    it('encodes a 0-length byte string as 0x40', () => {
        expect(Array.from(cborEncode(new Uint8Array(0)))).toEqual([0x40])
    })

    it('uses a 1-byte length prefix at length 24 (0x58)', () => {
        const result = cborEncode(new Uint8Array(24))
        expect(result[0]).toBe(0x58)
        expect(result[1]).toBe(24)
        expect(result.length).toBe(26)
    })

    it('uses a 2-byte length prefix at length 256 (0x59)', () => {
        const result = cborEncode(new Uint8Array(256))
        expect(result[0]).toBe(0x59)
        expect(result[1]).toBe(0x01)
        expect(result[2]).toBe(0x00)
        expect(result.length).toBe(259)
    })
})

describe('cborEncode text strings', () => {
    it('encodes "none" with a 0x64 head', () => {
        const result = cborEncode('none')
        expect(Array.from(result)).toEqual([0x64, 0x6e, 0x6f, 0x6e, 0x65])
    })

    it('encodes the empty string as 0x60', () => {
        expect(Array.from(cborEncode(''))).toEqual([0x60])
    })
})

describe('cborEncode arrays', () => {
    it('encodes [1, 2, 3] as 0x83 0x01 0x02 0x03', () => {
        expect(Array.from(cborEncode([1, 2, 3]))).toEqual([
            0x83, 0x01, 0x02, 0x03,
        ])
    })
})

describe('cborEncode maps', () => {
    it('encodes [[1,2],[3,-7]] as 0xa2 0x01 0x02 0x03 0x26', () => {
        const result = cborEncode([
            [1, 2],
            [3, -7],
        ])
        expect(Array.from(result)).toEqual([0xa2, 0x01, 0x02, 0x03, 0x26])
    })

    it('preserves the given (non-sorted) key order', () => {
        const result = cborEncode([
            [3, 1],
            [1, 2],
        ])
        expect(Array.from(result)).toEqual([0xa2, 0x03, 0x01, 0x01, 0x02])
    })

    it('encodes the empty map via cborEncodeMap as 0xa0', () => {
        expect(Array.from(cborEncodeMap([]))).toEqual([0xa0])
    })

    it('supports byte-string and text-string values inside maps', () => {
        const result = cborEncode([['fmt', 'none']])
        // a1 (map(1)) 63 "fmt" 64 "none"
        expect(hex(result)).toBe('a163666d74646e6f6e65')
    })
})

describe('cborEncode validation', () => {
    it('throws on non-integer numbers', () => {
        expect(() => cborEncode(1.5)).toThrow()
    })
})

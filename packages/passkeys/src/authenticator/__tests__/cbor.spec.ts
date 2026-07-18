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

import { describe, expect, it } from 'vitest'
import {
    encodeCborBytes,
    encodeCborInt,
    encodeCborMap,
    encodeCborText,
} from '../cbor'

describe('encodeCborInt', () => {
    it('encodes small non-negative ints inline in the type-0 byte', () => {
        expect(Array.from(encodeCborInt(2))).toEqual([0x02])
    })

    it('encodes -1 as the smallest type-1 (negint) value', () => {
        expect(Array.from(encodeCborInt(-1))).toEqual([0x20])
    })

    it('encodes -7 (COSE ES256 alg) as a type-1 negint', () => {
        expect(Array.from(encodeCborInt(-7))).toEqual([0x26])
    })

    it('encodes 23 inline (largest 1-byte-header uint)', () => {
        expect(Array.from(encodeCborInt(23))).toEqual([0x17])
    })

    it('encodes 24 with a 1-byte length extension', () => {
        expect(Array.from(encodeCborInt(24))).toEqual([0x18, 0x18])
    })

    it('encodes 255 with a 1-byte length extension', () => {
        expect(Array.from(encodeCborInt(255))).toEqual([0x18, 0xff])
    })

    it('encodes 256 with a 2-byte big-endian length extension', () => {
        expect(Array.from(encodeCborInt(256))).toEqual([0x19, 0x01, 0x00])
    })
})

describe('encodeCborText', () => {
    it('encodes a 3-char string as a type-3 header with inline length', () => {
        expect(Array.from(encodeCborText('fmt'))).toEqual([
            0x63,
            'f'.charCodeAt(0),
            'm'.charCodeAt(0),
            't'.charCodeAt(0),
        ])
    })

    it('encodes a 4-char string as a type-3 header with inline length', () => {
        expect(Array.from(encodeCborText('none'))).toEqual([
            0x64,
            'n'.charCodeAt(0),
            'o'.charCodeAt(0),
            'n'.charCodeAt(0),
            'e'.charCodeAt(0),
        ])
    })
})

describe('encodeCborBytes', () => {
    it('encodes a 32-byte string as a type-2 header with a 1-byte length extension', () => {
        const bytes = new Uint8Array(32).fill(0xab)
        const encoded = encodeCborBytes(bytes)

        expect(encoded[0]).toBe(0x58)
        expect(encoded[1]).toBe(0x20)
        expect(Array.from(encoded.slice(2))).toEqual(Array.from(bytes))
    })

    it('encodes a 256-byte string with a 2-byte big-endian length extension', () => {
        const bytes = new Uint8Array(256).fill(0x01)
        const encoded = encodeCborBytes(bytes)

        expect(encoded[0]).toBe(0x59)
        expect(encoded[1]).toBe(0x01)
        expect(encoded[2]).toBe(0x00)
        expect(Array.from(encoded.slice(3))).toEqual(Array.from(bytes))
    })
})

describe('encodeCborMap', () => {
    it('encodes an empty map as the bare type-5 header', () => {
        expect(Array.from(encodeCborMap([]))).toEqual([0xa0])
    })

    it('encodes a 5-pair map with an inline-length header and pairs in order', () => {
        const pairs: [Uint8Array, Uint8Array][] = [
            [encodeCborInt(1), encodeCborInt(2)],
            [encodeCborInt(3), encodeCborInt(-7)],
            [encodeCborInt(-1), encodeCborInt(1)],
            [encodeCborInt(-2), encodeCborBytes(new Uint8Array(2).fill(0xaa))],
            [encodeCborInt(-3), encodeCborBytes(new Uint8Array(2).fill(0xbb))],
        ]

        const encoded = encodeCborMap(pairs)

        expect(encoded[0]).toBe(0xa5)
        expect(Array.from(encoded)).toEqual([
            0xa5, 0x01, 0x02, 0x03, 0x26, 0x20, 0x01, 0x21, 0x42, 0xaa, 0xaa,
            0x22, 0x42, 0xbb, 0xbb,
        ])
    })
})

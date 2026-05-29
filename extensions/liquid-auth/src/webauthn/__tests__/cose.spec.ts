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

import { coseP256PublicKey } from '../cose'

const fill = (value: number): Uint8Array => new Uint8Array(32).fill(value)

describe('coseP256PublicKey', () => {
    it('emits the canonical kty/alg/crv prefix in order', () => {
        const result = coseP256PublicKey(fill(0xaa), fill(0xbb))
        // a5  -> map(5)
        // 01 02 -> kty: EC2
        // 03 26 -> alg: ES256 (-7)
        // 20 01 -> crv (-1): P-256
        // 21 5820 ... -> x (-2): 32-byte bstr
        // 22 5820 ... -> y (-3): 32-byte bstr
        expect(Array.from(result.slice(0, 9))).toEqual([
            0xa5, 0x01, 0x02, 0x03, 0x26, 0x20, 0x01, 0x21, 0x58,
        ])
    })

    it('embeds x and y as 32-byte byte strings at the expected offsets', () => {
        const x = fill(0x11)
        const y = fill(0x22)
        const result = coseP256PublicKey(x, y)
        // header(7 bytes: a5 01 02 03 26 20 01) + x-key(21) + bstr-head(58 20)
        const xStart = 7 + 1 + 2
        expect(Array.from(result.slice(xStart, xStart + 32))).toEqual(
            Array.from(x),
        )
        // x block consumed; y-key(22) + bstr-head(58 20)
        const yStart = xStart + 32 + 1 + 2
        expect(result[yStart - 3]).toBe(0x22)
        expect(result[yStart - 2]).toBe(0x58)
        expect(result[yStart - 1]).toBe(0x20)
        expect(Array.from(result.slice(yStart, yStart + 32))).toEqual(
            Array.from(y),
        )
        expect(result.length).toBe(yStart + 32)
    })

    it('rejects coordinates that are not 32 bytes', () => {
        expect(() => coseP256PublicKey(new Uint8Array(31), fill(0))).toThrow()
        expect(() => coseP256PublicKey(fill(0), new Uint8Array(33))).toThrow()
    })
})

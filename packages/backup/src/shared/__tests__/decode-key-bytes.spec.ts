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
import { decodePrivateKeyBytes } from '../decode-key-bytes'

const base64Of = (bytes: number[]): string =>
    Buffer.from(Uint8Array.from(bytes)).toString('base64')

describe('decodePrivateKeyBytes — base64', () => {
    it('decodes a 32-byte seed', () => {
        const bytes = Array.from({ length: 32 }, (_, i) => i)
        const result = decodePrivateKeyBytes(base64Of(bytes))
        expect(result).not.toBeNull()
        expect(result).toEqual(Uint8Array.from(bytes))
    })

    it('decodes a 64-byte tweetnacl secret key', () => {
        const bytes = Array.from({ length: 64 }, (_, i) => i % 256)
        const result = decodePrivateKeyBytes(base64Of(bytes))
        expect(result).toEqual(Uint8Array.from(bytes))
    })

    it('returns null for a base64 buffer of a disallowed length', () => {
        const bytes = Array.from({ length: 31 }, () => 1)
        expect(decodePrivateKeyBytes(base64Of(bytes))).toBeNull()
    })

    it('returns null for an undecodable / wrong-length string', () => {
        // "abc" → 3 bytes, neither 32 nor 64.
        expect(decodePrivateKeyBytes('YWJj')).toBeNull()
    })

    it('does not accept comma-separated input unless explicitly opted in', () => {
        const csv = Array.from({ length: 32 }, () => '1').join(',')
        expect(decodePrivateKeyBytes(csv)).toBeNull()
    })

    it('returns null for an oversized string before attempting to decode', () => {
        // Well beyond any valid key encoding — rejected by the length guard.
        expect(decodePrivateKeyBytes('A'.repeat(513))).toBeNull()
    })
})

describe('decodePrivateKeyBytes — legacy comma-separated', () => {
    const opts = { allowCommaSeparated: true }

    it('decodes a 32-value comma-separated buffer', () => {
        const values = Array.from({ length: 32 }, (_, i) => i)
        const result = decodePrivateKeyBytes(values.join(','), opts)
        expect(result).toEqual(Uint8Array.from(values))
    })

    it('decodes a 64-value comma-separated buffer with surrounding whitespace', () => {
        const values = Array.from({ length: 64 }, (_, i) => i % 256)
        const result = decodePrivateKeyBytes(
            values.map(v => ` ${v} `).join(','),
            opts,
        )
        expect(result).toEqual(Uint8Array.from(values))
    })

    it('returns null when the value count is not 32 or 64', () => {
        const values = Array.from({ length: 10 }, () => '1')
        expect(decodePrivateKeyBytes(values.join(','), opts)).toBeNull()
    })

    it('returns null when any value is out of the 0–255 byte range', () => {
        const values = Array.from({ length: 32 }, () => '1')
        values[5] = '300'
        expect(decodePrivateKeyBytes(values.join(','), opts)).toBeNull()
    })

    it('returns null when any value is not an integer', () => {
        const values = Array.from({ length: 32 }, () => '1')
        values[0] = '1.5'
        expect(decodePrivateKeyBytes(values.join(','), opts)).toBeNull()
    })
})

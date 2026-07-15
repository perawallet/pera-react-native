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

import { describe, it, expect } from 'vitest'
import { encodeToBase64 } from '@perawallet/wallet-core-shared'
import { decodeArbitraryDataForDisplay } from '../arbitraryDataDisplay'

const base64Of = (bytes: number[]): string =>
    encodeToBase64(new Uint8Array(bytes))

describe('decodeArbitraryDataForDisplay', () => {
    it('returns readable UTF-8 payloads as text', () => {
        const data = encodeToBase64(new TextEncoder().encode('hello Pera'))

        expect(decodeArbitraryDataForDisplay(data)).toEqual({
            kind: 'text',
            text: 'hello Pera',
        })
    })

    it('keeps whitespace-formatted text as text', () => {
        const data = encodeToBase64(
            new TextEncoder().encode('line one\nline two\ttabbed'),
        )

        expect(decodeArbitraryDataForDisplay(data)).toEqual({
            kind: 'text',
            text: 'line one\nline two\ttabbed',
        })
    })

    it('falls back to hex for invalid UTF-8 byte sequences', () => {
        const data = base64Of([0x88, 0x81, 0xa1, 0xff])

        expect(decodeArbitraryDataForDisplay(data)).toEqual({
            kind: 'hex',
            hex: '8881a1ff',
        })
    })

    it('falls back to hex for valid UTF-8 carrying control characters', () => {
        const data = base64Of([0x00, 0x68, 0x69])

        expect(decodeArbitraryDataForDisplay(data)).toEqual({
            kind: 'hex',
            hex: '006869',
        })
    })

    it('falls back to hex for C1 control characters', () => {
        const data = encodeToBase64(new TextEncoder().encode('abc\u0085def'))

        expect(decodeArbitraryDataForDisplay(data).kind).toBe('hex')
    })

    it('falls back to hex for bidi override characters', () => {
        // U+202E can visually reverse what follows, so a user could read
        // something different from the bytes they sign.
        const data = encodeToBase64(
            new TextEncoder().encode('invoice \u202Etxt.exe'),
        )

        expect(decodeArbitraryDataForDisplay(data).kind).toBe('hex')
    })

    it('falls back to hex for zero-width characters', () => {
        const data = encodeToBase64(new TextEncoder().encode('pay\u200Bme'))

        expect(decodeArbitraryDataForDisplay(data).kind).toBe('hex')
    })

    it('falls back to hex for a byte-order mark inside the text', () => {
        const data = encodeToBase64(new TextEncoder().encode('a\uFEFFb'))

        expect(decodeArbitraryDataForDisplay(data).kind).toBe('hex')
    })

    it('falls back to hex for empty payloads', () => {
        expect(decodeArbitraryDataForDisplay(base64Of([]))).toEqual({
            kind: 'hex',
            hex: '',
        })
    })

    it('falls back to hex when the input is not valid base64', () => {
        const result = decodeArbitraryDataForDisplay('%%%not-base64%%%')

        expect(result.kind).toBe('hex')
    })
})

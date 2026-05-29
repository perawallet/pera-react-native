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

import { fromBase64Url, toBase64Url } from '../base64url'

describe('base64url', () => {
    it('encodes without padding and url-safe alphabet', () => {
        // bytes that produce + and / in standard base64
        const bytes = new Uint8Array([0xfb, 0xff, 0xbf])
        expect(toBase64Url(bytes)).toBe('-_-_')
    })

    it('decodes a string without padding', () => {
        expect(Array.from(fromBase64Url('-_-_'))).toEqual([0xfb, 0xff, 0xbf])
    })

    it('round-trips arbitrary byte content', () => {
        const original = new Uint8Array(257)
        for (let i = 0; i < original.length; i += 1) original[i] = i % 256
        const encoded = toBase64Url(original)
        expect(encoded).not.toContain('=')
        expect(encoded).not.toContain('+')
        expect(encoded).not.toContain('/')
        expect(Array.from(fromBase64Url(encoded))).toEqual(Array.from(original))
    })

    it('round-trips the empty array', () => {
        expect(toBase64Url(new Uint8Array(0))).toBe('')
        expect(fromBase64Url('')).toEqual(new Uint8Array(0))
    })
})

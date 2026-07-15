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
import { encodeToBase64 } from '../strings'
import {
    InputTooLargeError,
    assertMaxLength,
    decodeBoundedBase64,
} from '../bounds'

describe('assertMaxLength', () => {
    it('passes when the string is within the limit', () => {
        expect(() => assertMaxLength('hello', 5, 'field')).not.toThrow()
    })

    it('throws InputTooLargeError when the string exceeds the limit', () => {
        expect(() => assertMaxLength('toolong', 3, 'field')).toThrow(
            InputTooLargeError,
        )
    })

    it('carries the label, limit, and actual size on the error', () => {
        try {
            assertMaxLength('abcdef', 4, 'mnemonic')
            expect.unreachable('should have thrown')
        } catch (error) {
            expect(error).toBeInstanceOf(InputTooLargeError)
            const typed = error as InputTooLargeError
            expect(typed.label).toBe('mnemonic')
            expect(typed.limit).toBe(4)
            expect(typed.actual).toBe(6)
        }
    })
})

describe('decodeBoundedBase64', () => {
    it('decodes input whose decoded size is within the limit', () => {
        const original = new Uint8Array([1, 2, 3, 4])
        const decoded = decodeBoundedBase64(encodeToBase64(original), 4, 'txn')
        expect(Array.from(decoded)).toEqual([1, 2, 3, 4])
    })

    it('throws before decoding when the encoded length alone exceeds the limit', () => {
        // 400 base64 chars decode to ~300 bytes, well over a 16-byte cap.
        const huge = 'A'.repeat(400)
        expect(() => decodeBoundedBase64(huge, 16, 'txn')).toThrow(
            InputTooLargeError,
        )
    })

    it('throws when the decoded byte length exceeds the limit', () => {
        const original = new Uint8Array(100).fill(7)
        expect(() =>
            decodeBoundedBase64(encodeToBase64(original), 32, 'txn'),
        ).toThrow(InputTooLargeError)
    })
})

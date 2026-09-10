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

import { describe, test, expect, vi, afterEach } from 'vitest'
import { isValidAlgorandAddress, truncateAlgorandAddress } from '../addresses'

afterEach(() => {
    vi.restoreAllMocks()
})

describe('utils/addresses - truncateAlgorandAddress', () => {
    test('returns original when length <= 11', () => {
        expect(truncateAlgorandAddress('SHORT')).toEqual('SHORT')
        expect(truncateAlgorandAddress('ABCDEFGHIJK')).toEqual('ABCDEFGHIJK')
    })

    test('truncates when length > 11 (5+...+5)', () => {
        expect(truncateAlgorandAddress('ABCDEFGHIJKL')).toEqual('ABCDE...HIJKL')
        expect(truncateAlgorandAddress('ABCDEFGHIJKLMNOPQRSTUVWXYZ')).toEqual(
            'ABCDE...VWXYZ',
        )
    })

    test('uses an even split when maxLength is even', () => {
        expect(
            truncateAlgorandAddress('ABCDEFGHIJKLMNOPQRSTUVWXYZ', 8),
        ).toEqual('ABCD...WXYZ')
    })
})

describe('utils/addresses - isValidAlgorandAddress', () => {
    // Zero-key address (all-zero 32-byte public key)
    const validAddress =
        'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HFKQ'

    test('returns true for a checksum-valid address', () => {
        expect(isValidAlgorandAddress(validAddress)).toBe(true)
    })

    test('returns false for a 58-char string with a bad checksum', () => {
        const typo = `${validAddress.slice(0, -1)}A`
        expect(isValidAlgorandAddress(typo)).toBe(false)
    })

    test('returns false for a lowercased valid address', () => {
        expect(isValidAlgorandAddress(validAddress.toLowerCase())).toBe(false)
    })

    test('returns false for wrong length or invalid characters', () => {
        expect(isValidAlgorandAddress(validAddress.slice(1))).toBe(false)
        expect(isValidAlgorandAddress(`${validAddress.slice(0, -1)}@`)).toBe(
            false,
        )
    })

    test('returns false for empty or undefined', () => {
        expect(isValidAlgorandAddress('')).toBe(false)
        expect(isValidAlgorandAddress(undefined)).toBe(false)
    })
})

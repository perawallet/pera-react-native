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
import { encodeAlgorandAddress, isValidAlgorandAddress } from '../addresses'
import { encodeAddress } from '@algorandfoundation/algokit-utils'

describe('addresses utils', () => {
    describe('encodeAlgorandAddress', () => {
        it('should correctly encode bytes to Algorand address', () => {
            const bytes = new Uint8Array(32).fill(0)
            const expectedAddress = encodeAddress(bytes)
            expect(encodeAlgorandAddress(bytes)).toBe(expectedAddress)
        })
    })

    describe('isValidAlgorandAddress', () => {
        it('should return true for valid Algorand address', () => {
            const validAddress =
                'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
            expect(isValidAlgorandAddress(validAddress)).toBe(true)
        })

        it('should return false for invalid length', () => {
            const invalidAddress =
                'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' // 57 chars
            expect(isValidAlgorandAddress(invalidAddress)).toBe(false)
        })

        it('should return false for invalid characters', () => {
            const invalidAddress =
                'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA@' // Invalid char
            expect(isValidAlgorandAddress(invalidAddress)).toBe(false)
        })

        it('should return false for empty or undefined', () => {
            expect(isValidAlgorandAddress('')).toBe(false)
            expect(isValidAlgorandAddress(undefined)).toBe(false)
        })
    })
})

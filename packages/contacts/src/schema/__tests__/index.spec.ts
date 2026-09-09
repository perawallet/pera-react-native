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

import { describe, test, expect } from 'vitest'
import { contactSchema } from '..'

// Zero-key address (all-zero 32-byte public key)
const VALID_ADDRESS =
    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HFKQ'

const parseAddress = (address: string) =>
    contactSchema.safeParse({ name: 'Alice', address })

describe('contactSchema address validation', () => {
    test('accepts a checksum-valid address', () => {
        expect(parseAddress(VALID_ADDRESS).success).toBe(true)
    })

    test('rejects a 58-char string with a bad checksum (typo)', () => {
        expect(parseAddress(`${VALID_ADDRESS.slice(0, -1)}A`).success).toBe(
            false,
        )
    })

    test('rejects a lowercased valid address', () => {
        expect(parseAddress(VALID_ADDRESS.toLowerCase()).success).toBe(false)
    })

    test('rejects 58 alphanumeric characters that are not an address', () => {
        expect(parseAddress('a'.repeat(58)).success).toBe(false)
    })

    test('rejects wrong length and invalid characters', () => {
        expect(parseAddress(VALID_ADDRESS.slice(1)).success).toBe(false)
        expect(parseAddress(`${VALID_ADDRESS.slice(0, -1)}@`).success).toBe(
            false,
        )
    })
})

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

import { describe, test, expect } from 'vitest'
import { generateUniqueId, generateOrderedUniqueId } from '../uuid'

const UUID_REGEX =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

describe('generateUniqueId', () => {
    test('returns a v4 UUID (version nibble is 4) and each call is unique', () => {
        const a = generateUniqueId()
        const b = generateUniqueId()

        expect(a).toMatch(UUID_REGEX)
        expect(a.charAt(14)).toBe('4')
        expect(a).not.toBe(b)
    })
})

describe('generateOrderedUniqueId', () => {
    test('returns a v7 UUID (version nibble is 7) that sorts by time when called in sequence', () => {
        const first = generateOrderedUniqueId()
        const second = generateOrderedUniqueId()

        expect(first).toMatch(UUID_REGEX)
        expect(first.charAt(14)).toBe('7')
        // v7 is time-ordered: subsequent IDs compare greater lexicographically.
        expect(second >= first).toBe(true)
    })
})

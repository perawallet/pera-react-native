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
import { toEnumValue, toEnumValueOrNull } from '../enums'

const Status = {
    Active: 'ACTIVE',
    Frozen: 'FROZEN',
} as const

describe('toEnumValue', () => {
    test('returns the value when it is a known member', () => {
        expect(toEnumValue(Status, 'FROZEN', Status.Active)).toBe('FROZEN')
    })

    test('falls back for an unknown value', () => {
        expect(toEnumValue(Status, 'MYSTERY', Status.Active)).toBe('ACTIVE')
    })

    test('falls back for non-string input', () => {
        expect(toEnumValue(Status, 42, Status.Active)).toBe('ACTIVE')
        expect(toEnumValue(Status, null, Status.Active)).toBe('ACTIVE')
        expect(toEnumValue(Status, undefined, Status.Active)).toBe('ACTIVE')
    })
})

describe('toEnumValueOrNull', () => {
    test('returns the value when it is a known member', () => {
        expect(toEnumValueOrNull(Status, 'ACTIVE')).toBe('ACTIVE')
    })

    test('returns null for unknown or non-string values', () => {
        expect(toEnumValueOrNull(Status, 'NOPE')).toBeNull()
        expect(toEnumValueOrNull(Status, 7)).toBeNull()
        expect(toEnumValueOrNull(Status, null)).toBeNull()
    })
})

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

import { describe, expect, test } from 'vitest'
import { ARGON2ID_CONFIG } from '../constants'
import {
    isDerivableArgon2idConfig,
    isDerivableSaltLength,
    readArgon2idConfig,
} from '../argon2idConfig'
import { serializeArgon2idConfig } from '../serializeArgon2idConfig'

const BLOCK = serializeArgon2idConfig(ARGON2ID_CONFIG)

describe('readArgon2idConfig', () => {
    test('reads the snake_case block a file or QR carries', () => {
        expect(readArgon2idConfig(BLOCK)).toEqual(ARGON2ID_CONFIG)
    })

    test.each([
        ['null', null],
        ['an array', []],
        ['a partial block', { time_cost: 3 }],
        ['a zero parameter', { ...BLOCK, parallelism: 0 }],
        ['a fractional parameter', { ...BLOCK, memory_cost: 1.5 }],
        ['a string parameter', { ...BLOCK, time_cost: '3' }],
    ])('returns null for %s', (_, value) => {
        expect(readArgon2idConfig(value)).toBeNull()
    })
})

describe('isDerivableArgon2idConfig', () => {
    test("accepts this build's own parameters", () => {
        expect(isDerivableArgon2idConfig(ARGON2ID_CONFIG)).toBe(true)
    })

    // The bounds are ARGON2ID_CONFIG itself, so anything above any one of
    // them is refused — this build's own parameters are the upper bound.
    test.each([
        ['memoryCost', 257],
        ['timeCost', 4],
        ['parallelism', 2],
        ['outputLength', 64],
    ] as const)('refuses %s of %d', (field, value) => {
        expect(
            isDerivableArgon2idConfig({ ...ARGON2ID_CONFIG, [field]: value }),
        ).toBe(false)
    })
})

describe('isDerivableSaltLength', () => {
    test.each([
        [7, false],
        [8, true],
        [64, true],
        [65, false],
    ])('%d bytes → %s', (length, expected) => {
        expect(isDerivableSaltLength(length)).toBe(expected)
    })
})

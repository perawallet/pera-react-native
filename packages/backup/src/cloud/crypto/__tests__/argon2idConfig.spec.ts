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
    decodeBase64Salt,
    isCanonicalArgon2idConfig,
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

describe('isCanonicalArgon2idConfig', () => {
    test("accepts this build's own parameters", () => {
        expect(isCanonicalArgon2idConfig(ARGON2ID_CONFIG)).toBe(true)
    })

    test.each([
        ['memoryCost', 257],
        ['timeCost', 4],
        ['parallelism', 2],
        ['outputLength', 64],
    ] as const)('refuses %s raised to %d', (field, value) => {
        expect(
            isCanonicalArgon2idConfig({ ...ARGON2ID_CONFIG, [field]: value }),
        ).toBe(false)
    })

    // A weakened block derives a different master key just as surely as a
    // raised one, so the parameters are pinned rather than capped.
    test.each([
        ['memoryCost', 1],
        ['timeCost', 1],
        ['outputLength', 16],
    ] as const)('refuses %s lowered to %d', (field, value) => {
        expect(
            isCanonicalArgon2idConfig({ ...ARGON2ID_CONFIG, [field]: value }),
        ).toBe(false)
    })
})

describe('isDerivableArgon2idConfig', () => {
    test("accepts this build's own parameters", () => {
        expect(isDerivableArgon2idConfig(ARGON2ID_CONFIG)).toBe(true)
    })

    // A transport KDF may legitimately be costlier than this build's, so the
    // bound sits above ARGON2ID_CONFIG rather than on it.
    test.each([
        ['memoryCost', 512],
        ['timeCost', 10],
        ['parallelism', 4],
    ] as const)('accepts %s of %d', (field, value) => {
        expect(
            isDerivableArgon2idConfig({ ...ARGON2ID_CONFIG, [field]: value }),
        ).toBe(true)
    })

    test.each([
        ['memoryCost', 513],
        ['timeCost', 11],
        ['parallelism', 5],
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

describe('decodeBase64Salt', () => {
    test('decodes a salt this build wrote', () => {
        expect(decodeBase64Salt('q311Z4ReDNWpMVuH8XdvSw==')).toHaveLength(16)
    })

    test.each([
        ['spaces of a decodable length', '            '],
        ['a length that is not base64', '!!!'],
        ['an out-of-alphabet character', 'q311Z4Re*NWpMVuH8XdvSw=='],
        ['padding in the middle', 'q311Z4Re=NWpMVuH8XdvSw=='],
        ['a url-safe alphabet we never write', 'q311Z4Re-NWpMVuH8XdvS_=='],
    ])('returns null for %s', (_, value) => {
        expect(decodeBase64Salt(value)).toBeNull()
    })
})

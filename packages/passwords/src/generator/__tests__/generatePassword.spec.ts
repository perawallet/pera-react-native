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

import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_PASSWORD_LENGTH, generatePassword } from '../generatePassword'

const LOWER = /[a-z]/
const UPPER = /[A-Z]/
const DIGIT = /[0-9]/
const SYMBOL = /[^a-zA-Z0-9]/

describe('generatePassword', () => {
    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('returns a password of the default length', () => {
        const password = generatePassword()

        expect(password).toHaveLength(DEFAULT_PASSWORD_LENGTH)
        expect(DEFAULT_PASSWORD_LENGTH).toBeGreaterThanOrEqual(16)
    })

    it('honours a requested length', () => {
        expect(generatePassword({ length: 32 })).toHaveLength(32)
    })

    it('always contains a lowercase letter, an uppercase letter, a digit and a symbol', () => {
        for (let i = 0; i < 100; i++) {
            const password = generatePassword({ length: 4 })

            expect(password).toMatch(LOWER)
            expect(password).toMatch(UPPER)
            expect(password).toMatch(DIGIT)
            expect(password).toMatch(SYMBOL)
        }
    })

    it('never emits characters that forms or copy-paste mangle', () => {
        for (let i = 0; i < 100; i++) {
            expect(generatePassword()).not.toMatch(/[\s"'`\\]/)
        }
    })

    it('does not place the guaranteed classes at fixed positions', () => {
        const firstChars = new Set<string>()
        for (let i = 0; i < 200; i++) {
            firstChars.add(
                LOWER.test(generatePassword()[0]) ? 'lower' : 'other',
            )
        }

        expect(firstChars.size).toBe(2)
    })

    it('produces a different password on every call', () => {
        expect(generatePassword()).not.toBe(generatePassword())
    })

    it('draws from the platform CSPRNG, never Math.random', () => {
        const mathRandom = vi.spyOn(Math, 'random')
        const getRandomValues = vi.spyOn(crypto, 'getRandomValues')

        generatePassword()

        expect(mathRandom).not.toHaveBeenCalled()
        expect(getRandomValues).toHaveBeenCalled()
    })

    it('rejects a length too short to hold one character of every class', () => {
        expect(() => generatePassword({ length: 3 })).toThrow(RangeError)
    })
})

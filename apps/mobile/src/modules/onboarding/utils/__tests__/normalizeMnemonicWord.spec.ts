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

// @vitest-environment node

import { describe, expect, it } from 'vitest'

import { normalizeMnemonicWord } from '../normalizeMnemonicWord'

describe('normalizeMnemonicWord', () => {
    it('lowercases a capitalized word', () => {
        expect(normalizeMnemonicWord('Abandon')).toBe('abandon')
    })

    it('lowercases an all-caps word', () => {
        expect(normalizeMnemonicWord('ABANDON')).toBe('abandon')
    })

    it('strips surrounding whitespace', () => {
        expect(normalizeMnemonicWord('  abandon  ')).toBe('abandon')
    })

    it('strips punctuation an IME may append', () => {
        expect(normalizeMnemonicWord('abandon.')).toBe('abandon')
        expect(normalizeMnemonicWord('abandon,')).toBe('abandon')
        expect(normalizeMnemonicWord("abandon'")).toBe('abandon')
    })

    it('strips digits and non-latin characters', () => {
        expect(normalizeMnemonicWord('abandon1')).toBe('abandon')
        expect(normalizeMnemonicWord('aban—don')).toBe('abandon')
    })

    it('leaves an already-clean word untouched', () => {
        expect(normalizeMnemonicWord('abandon')).toBe('abandon')
    })

    it('returns an empty string for input with no latin letters', () => {
        expect(normalizeMnemonicWord('   ')).toBe('')
        expect(normalizeMnemonicWord('123')).toBe('')
    })
})

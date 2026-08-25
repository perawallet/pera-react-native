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

    it('strips punctuation but keeps digits so the token still fails validation', () => {
        expect(normalizeMnemonicWord('aban—don')).toBe('abandon')
        expect(normalizeMnemonicWord('abandon1')).toBe('abandon1')
        expect(normalizeMnemonicWord('123')).toBe('123')
    })

    it('leaves an already-clean word untouched', () => {
        expect(normalizeMnemonicWord('abandon')).toBe('abandon')
    })

    it('returns an empty string for whitespace-only input', () => {
        expect(normalizeMnemonicWord('   ')).toBe('')
    })

    it('does not silently correct a mistyped word into a different real word', () => {
        // A digit is not an IME artifact — it's a genuine typo, so it must
        // survive normalization and fail wordlist validation downstream.
        expect(normalizeMnemonicWord('abandon5')).toBe('abandon5')
    })

    it('strips invisible format characters an IME can inject silently', () => {
        // Written as escapes, not literal invisible characters, so the
        // characters under test survive review instead of being
        // "helpfully" deleted by an editor.
        const zeroWidthSpace = '\u200B'
        const zeroWidthJoiner = '\u200D'
        expect(normalizeMnemonicWord(`aban${zeroWidthSpace}don`)).toBe(
            'abandon',
        )
        expect(normalizeMnemonicWord(`aban${zeroWidthJoiner}don`)).toBe(
            'abandon',
        )
        expect(normalizeMnemonicWord('abandon1')).toBe('abandon1')
    })
})

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

import { describe, expect, it } from 'vitest'
import { wordlist } from '@scure/bip39/wordlists/english.js'
import {
    indicesToUtf8Bytes,
    mnemonicIndexToWord,
    mnemonicWordsToIndices,
} from '../mnemonic-indices'

describe('mnemonicWordsToIndices', () => {
    it('maps each word to its wordlist index', () => {
        const indices = mnemonicWordsToIndices(['abandon', 'ability', 'zoo'])

        expect(indices).toBeInstanceOf(Uint16Array)
        expect(Array.from(indices!)).toEqual([
            wordlist.indexOf('abandon'),
            wordlist.indexOf('ability'),
            wordlist.indexOf('zoo'),
        ])
    })

    it('returns null when any token is not a wordlist word', () => {
        expect(mnemonicWordsToIndices(['abandon', 'notaword'])).toBeNull()
    })

    it('returns an empty Uint16Array for an empty word list', () => {
        const indices = mnemonicWordsToIndices([])

        expect(indices).toBeInstanceOf(Uint16Array)
        expect(indices!.length).toBe(0)
    })
})

describe('mnemonicIndexToWord', () => {
    it('maps a single index back to its wordlist word', () => {
        expect(mnemonicIndexToWord(wordlist.indexOf('abandon'))).toBe('abandon')
        expect(mnemonicIndexToWord(wordlist.indexOf('zoo'))).toBe('zoo')
    })

    it('throws a RangeError for an out-of-range index', () => {
        expect(() => mnemonicIndexToWord(wordlist.length)).toThrow(RangeError)
    })

    it('round-trips a full mnemonic without altering it', () => {
        const words =
            'champion say kitchen sock defense example mesh body sample artwork warfare canvas item recall cheese total floor cycle such asthma okay immense lake street'.split(
                ' ',
            )

        const indices = mnemonicWordsToIndices(words)

        expect(Array.from(indices!, mnemonicIndexToWord)).toEqual(words)
    })
})

describe('indicesToUtf8Bytes', () => {
    it('encodes exactly the UTF-8 bytes of the space-joined phrase', () => {
        const words =
            'champion say kitchen sock defense example mesh body sample artwork warfare canvas item recall cheese total floor cycle such asthma okay immense lake street'.split(
                ' ',
            )
        const indices = mnemonicWordsToIndices(words)!

        expect(Array.from(indicesToUtf8Bytes(indices))).toEqual(
            Array.from(new TextEncoder().encode(words.join(' '))),
        )
    })

    it('returns an empty buffer for no indices', () => {
        expect(indicesToUtf8Bytes(new Uint16Array(0)).length).toBe(0)
    })

    it('throws for an out-of-range index', () => {
        expect(() => indicesToUtf8Bytes(Uint16Array.of(2048))).toThrow(
            RangeError,
        )
    })
})

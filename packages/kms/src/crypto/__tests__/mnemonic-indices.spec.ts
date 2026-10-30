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
import { entropyToMnemonic } from '@scure/bip39'
import { wordlist } from '@scure/bip39/wordlists/english.js'
import { deriveLiquidAuthMainKey, entropyToIndices } from '../hdwallet-utils'
import {
    indicesToUtf8Bytes,
    mnemonicIndexToWord,
    mnemonicWordsToIndices,
    utf8BytesToIndices,
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

describe('utf8BytesToIndices', () => {
    const PHRASE =
        'champion say kitchen sock defense example mesh body sample artwork warfare canvas item recall cheese total floor cycle such asthma okay immense lake street'

    const viaStrings = (bytes: Uint8Array) =>
        mnemonicWordsToIndices(new TextDecoder().decode(bytes).split(' '))

    it('resolves every wordlist word to its index', () => {
        const bytes = new TextEncoder().encode(wordlist.join(' '))

        expect(Array.from(utf8BytesToIndices(bytes)!)).toEqual(
            wordlist.map((_, index) => index),
        )
    })

    it('is the inverse of indicesToUtf8Bytes', () => {
        const indices = mnemonicWordsToIndices(PHRASE.split(' '))!

        const parsed = utf8BytesToIndices(indicesToUtf8Bytes(indices))

        expect(parsed).toBeInstanceOf(Uint16Array)
        expect(Array.from(parsed!)).toEqual(Array.from(indices))
    })

    it.each([
        ['an unknown word', 'abandon notaword zoo'],
        ['a prefix of a word', 'aband'],
        ['a word with a suffix', 'abandons'],
        ['an empty phrase', ''],
        ['a double space', 'abandon  zoo'],
        ['a trailing space', 'abandon zoo '],
        ['a leading space', ' abandon zoo'],
        ['an upper-case word', 'Abandon zoo'],
        ['a non-ASCII byte', 'abandon z\u00f6o'],
    ])('returns null, as the string route does, for %s', (_, text) => {
        const bytes = new TextEncoder().encode(text)

        expect(viaStrings(bytes)).toBeNull()
        expect(utf8BytesToIndices(bytes)).toBeNull()
    })

    it('returns null for bytes that are not valid UTF-8', () => {
        const bytes = Uint8Array.of(0x61, 0xff, 0xfe)

        expect(viaStrings(bytes)).toBeNull()
        expect(utf8BytesToIndices(bytes)).toBeNull()
    })

    it('agrees with the string route on a single word', () => {
        const bytes = new TextEncoder().encode('zoo')

        expect(Array.from(utf8BytesToIndices(bytes)!)).toEqual(
            Array.from(viaStrings(bytes)!),
        )
    })
})

// Unmocked on purpose: the passkey migration feeds these bytes to PBKDF2 where it
// used to feed scure's phrase string, so any drift changes every derived key.
describe('indicesToUtf8Bytes over entropyToIndices', () => {
    const fromHex = (hex: string) => Uint8Array.from(Buffer.from(hex, 'hex'))
    const ENTROPIES: Array<[string, Uint8Array]> = [
        ['all-zero 128-bit', new Uint8Array(16)],
        ['all-0xff 128-bit', new Uint8Array(16).fill(0xff)],
        ['BIP39 vector 7f… 128-bit', new Uint8Array(16).fill(0x7f)],
        [
            'BIP39 vector 9e88… 128-bit',
            fromHex('9e885d952ad362caeb4efe34a8e91bd2'),
        ],
        ['all-zero 256-bit', new Uint8Array(32)],
        ['all-0xff 256-bit', new Uint8Array(32).fill(0xff)],
        ['BIP39 vector 80… 256-bit', new Uint8Array(32).fill(0x80)],
        [
            'BIP39 vector 68a7… 256-bit',
            fromHex(
                '68a79eaca2324873eacc50cb9c6eca8cc68ea5d936f98787c60c7ebc74e6ce7c',
            ),
        ],
    ]

    it.each(ENTROPIES)(
        'is byte-equal to the UTF-8 of scure entropyToMnemonic for %s entropy',
        (_, entropy) => {
            const expected = new TextEncoder().encode(
                entropyToMnemonic(entropy, wordlist),
            )

            const bytes = indicesToUtf8Bytes(entropyToIndices(entropy))

            expect(Array.from(bytes)).toEqual(Array.from(expected))
        },
    )

    it('reaches the dp256 golden main key from all-zero 128-bit entropy', async () => {
        const phrase = indicesToUtf8Bytes(entropyToIndices(new Uint8Array(16)))

        const key = await deriveLiquidAuthMainKey(phrase)

        expect(Buffer.from(key).toString('hex')).toBe(
            '80ec8c0fc085095e052d18e461bd46d792d37c4d4e0e4b25f3a9b49650bf8af7e3760656b3ca62ad50c9a2b64115a205e16bc27712ba76db014d06ed4ac31670',
        )
    })
})

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
import { describe, test, expect } from 'vitest'
import { mnemonicToEntropy, mnemonicToSeed } from '@scure/bip39'
import { wordlist } from '@scure/bip39/wordlists/english.js'
import {
    deriveLiquidAuthMainKey,
    entropyToIndices,
    entropyToMnemonic,
    generateHDMasterKey,
    indicesToEntropy,
} from '../hdwallet-utils'
import {
    mnemonicIndexToWord,
    mnemonicWordsToIndices,
} from '../mnemonic-indices'

const TEST_MNEMONIC =
    'champion say kitchen sock defense example mesh body sample artwork warfare canvas item recall cheese total floor cycle such asthma okay immense lake street'
const TEST_INDICES = mnemonicWordsToIndices(TEST_MNEMONIC.split(' '))!

describe('generateHDMasterKey', () => {
    test('produces a seed byte-identical to @scure/bip39 mnemonicToSeed', async () => {
        const expected = await mnemonicToSeed(TEST_MNEMONIC)
        const { seed } = await generateHDMasterKey(TEST_INDICES)

        expect(Buffer.from(seed).equals(expected)).toBe(true)
        expect(seed.byteLength).toBe(64)
    })

    test('does not consume or zero the caller-supplied indices', async () => {
        const indices = mnemonicWordsToIndices(TEST_MNEMONIC.split(' '))!
        await generateHDMasterKey(indices)

        expect(Array.from(indices)).toEqual(Array.from(TEST_INDICES))
    })

    test('returns entropy matching the supplied indices', async () => {
        const expectedEntropy = mnemonicToEntropy(TEST_MNEMONIC, wordlist)
        const { entropy } = await generateHDMasterKey(TEST_INDICES)

        expect(Buffer.from(entropy).equals(Buffer.from(expectedEntropy))).toBe(
            true,
        )
    })

    test('generates fresh 256-bit entropy when no indices are supplied', async () => {
        const a = await generateHDMasterKey()
        const b = await generateHDMasterKey()

        expect(a.entropy.byteLength).toBe(32)
        expect(b.entropy.byteLength).toBe(32)
        expect(Buffer.from(a.entropy).equals(Buffer.from(b.entropy))).toBe(
            false,
        )
    })
})

describe('entropyToIndices', () => {
    const entropies: Record<string, Uint8Array> = {
        '128-bit': Uint8Array.from({ length: 16 }, (_, i) => (i * 17) & 0xff),
        '256-bit': Uint8Array.from(
            { length: 32 },
            (_, i) => (i * 7 + 3) & 0xff,
        ),
        'all-zero 256-bit': new Uint8Array(32),
    }

    test.each(Object.entries(entropies))(
        'matches the @scure word path for %s entropy',
        (_label, entropy) => {
            const viaWords = mnemonicWordsToIndices(
                entropyToMnemonic(entropy).split(' '),
            )
            expect(Array.from(entropyToIndices(entropy))).toEqual(
                Array.from(viaWords!),
            )
        },
    )

    test('encodes the canonical all-zero 24-word vector', () => {
        const indices = entropyToIndices(new Uint8Array(32))
        const words = Array.from(indices, mnemonicIndexToWord)
        expect(words.slice(0, 23)).toEqual(Array(23).fill('abandon'))
        expect(words[23]).toBe('art')
    })

    test('rejects entropy that is not a valid BIP39 length', () => {
        expect(() => entropyToIndices(new Uint8Array(31))).toThrow(RangeError)
        expect(() => entropyToIndices(new Uint8Array(0))).toThrow(RangeError)
    })
})

describe('indicesToEntropy', () => {
    const entropies: Record<string, Uint8Array> = {
        '128-bit': Uint8Array.from({ length: 16 }, (_, i) => (i * 17) & 0xff),
        '256-bit': Uint8Array.from(
            { length: 32 },
            (_, i) => (i * 7 + 3) & 0xff,
        ),
        'all-zero 256-bit': new Uint8Array(32),
    }

    test.each(Object.entries(entropies))(
        'round-trips entropyToIndices for %s entropy',
        (_label, entropy) => {
            expect(
                Array.from(indicesToEntropy(entropyToIndices(entropy))),
            ).toEqual(Array.from(entropy))
        },
    )

    test('matches the @scure mnemonicToEntropy word path', () => {
        const expected = mnemonicToEntropy(TEST_MNEMONIC, wordlist)
        expect(Array.from(indicesToEntropy(TEST_INDICES))).toEqual(
            Array.from(expected),
        )
    })

    test('decodes a 12-word phrase (the ASB recovery-key size)', () => {
        const phrase =
            'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
        const expected = mnemonicToEntropy(phrase, wordlist)
        const indices = mnemonicWordsToIndices(phrase.split(' '))!
        expect(Array.from(indicesToEntropy(indices))).toEqual(
            Array.from(expected),
        )
    })

    test('rejects a corrupted checksum', () => {
        const indices = entropyToIndices(new Uint8Array(32))
        indices[indices.length - 1] ^= 1
        expect(() => indicesToEntropy(indices)).toThrow(/checksum/)
    })

    test('rejects a flipped data word (checksum no longer matches)', () => {
        const indices = entropyToIndices(new Uint8Array(32))
        indices[0] = 1
        expect(() => indicesToEntropy(indices)).toThrow(/checksum/)
    })

    test('rejects an invalid word count', () => {
        expect(() => indicesToEntropy(new Uint16Array(13))).toThrow(RangeError)
        expect(() => indicesToEntropy(new Uint16Array(0))).toThrow(RangeError)
    })

    test('rejects an out-of-range index', () => {
        const indices = entropyToIndices(new Uint8Array(32))
        indices[0] = 2048
        expect(() => indicesToEntropy(indices)).toThrow(RangeError)
    })
})

describe('deriveLiquidAuthMainKey', () => {
    const ZERO_MNEMONIC =
        'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
    const DP256_GOLDEN_HEX =
        '80ec8c0fc085095e052d18e461bd46d792d37c4d4e0e4b25f3a9b49650bf8af7e3760656b3ca62ad50c9a2b64115a205e16bc27712ba76db014d06ed4ac31670'

    test('matches the dp256 derived main key byte-for-byte', async () => {
        const key = await deriveLiquidAuthMainKey(ZERO_MNEMONIC)

        expect(Buffer.from(key).toString('hex')).toBe(DP256_GOLDEN_HEX)
        expect(key.byteLength).toBe(64)
    })

    test('differs from the BIP39 seed (different salt and iterations)', async () => {
        const mainKey = await deriveLiquidAuthMainKey(ZERO_MNEMONIC)
        const { seed } = await generateHDMasterKey(
            mnemonicWordsToIndices(ZERO_MNEMONIC.split(' '))!,
        )

        expect(Buffer.from(mainKey).equals(Buffer.from(seed))).toBe(false)
    })
})

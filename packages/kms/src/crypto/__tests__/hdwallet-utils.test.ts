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

// @vitest-environment node
import { describe, test, expect } from 'vitest'
import { mnemonicToEntropy, mnemonicToSeed } from '@scure/bip39'
import { wordlist } from '@scure/bip39/wordlists/english.js'
import { deriveLiquidAuthMainKey, generateHDMasterKey } from '../hdwallet-utils'

const TEST_MNEMONIC =
    'champion say kitchen sock defense example mesh body sample artwork warfare canvas item recall cheese total floor cycle such asthma okay immense lake street'

describe('generateHDMasterKey', () => {
    test('produces a seed byte-identical to @scure/bip39 mnemonicToSeed', async () => {
        const expected = await mnemonicToSeed(TEST_MNEMONIC)
        const { seed } = await generateHDMasterKey(TEST_MNEMONIC)

        expect(Buffer.from(seed).equals(expected)).toBe(true)
        expect(seed.byteLength).toBe(64)
    })

    test('returns the supplied mnemonic and a matching entropy', async () => {
        const expectedEntropy = mnemonicToEntropy(TEST_MNEMONIC, wordlist)
        const { mnemonic, entropy } = await generateHDMasterKey(TEST_MNEMONIC)

        expect(mnemonic).toBe(TEST_MNEMONIC)
        expect(Buffer.from(entropy).equals(Buffer.from(expectedEntropy))).toBe(
            true,
        )
    })

    test('generates a fresh 24-word mnemonic when none is supplied', async () => {
        const a = await generateHDMasterKey()
        const b = await generateHDMasterKey()

        expect(a.mnemonic.split(' ').length).toBe(24)
        expect(b.mnemonic.split(' ').length).toBe(24)
        expect(a.mnemonic).not.toBe(b.mnemonic)
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
        const { seed } = await generateHDMasterKey(ZERO_MNEMONIC)

        expect(Buffer.from(mainKey).equals(Buffer.from(seed))).toBe(false)
    })
})

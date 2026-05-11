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
import { generateHDMasterKey } from '../hdwallet-utils'

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

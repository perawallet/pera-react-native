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

import { describe, test, expect } from 'vitest'
import { seedFromMnemonic } from 'algosdk'
import {
    deriveQuantumAddress,
    derivePQKeygenSeed,
} from '@perawallet/wallet-core-blockchain'
import { algo25SeedToIndices } from '../algo25-utils'
import { mnemonicIndexToWord } from '../mnemonic-indices'
import { getPQProvider } from '../pq'

/**
 * Integration tests for the quantum key pipeline. The quantum
 * mnemonic format IS algo25, so import→export must round-trip through the
 * shared algo25 utilities, and the real Falcon derivation must be
 * deterministic from the mnemonic (device portability).
 *
 * THROWAWAY TEST VECTOR — published in source; NEVER fund it.
 */

const TEST_MNEMONIC =
    'evoke unique jaguar rapid silent sister kingdom farm anger brother begin fluid brave sister mixture wedding suffer spin spatial combine ginger neutral lunch absorb upset'

describe('quantum integration', () => {
    test('import → export roundtrip: mnemonic → seed → indices reproduces the same 25 words', () => {
        const seed = seedFromMnemonic(TEST_MNEMONIC)
        const indices = algo25SeedToIndices(seed)

        expect(indices).toHaveLength(25)
        const words = Array.from(indices, mnemonicIndexToWord)
        expect(words.join(' ')).toBe(TEST_MNEMONIC)
    })

    test('same mnemonic yields the same quantum public key and address across independent derivations', () => {
        const deriveOnce = (): { publicKey: Uint8Array; address: string } => {
            const seed = seedFromMnemonic(TEST_MNEMONIC)
            const { publicKey } = getPQProvider().generateKeypairFromSeed(
                derivePQKeygenSeed(seed),
            )
            return { publicKey, address: deriveQuantumAddress(publicKey) }
        }

        const first = deriveOnce()
        const second = deriveOnce()

        expect(Array.from(first.publicKey)).toEqual(
            Array.from(second.publicKey),
        )
        expect(first.address).toBe(second.address)
        expect(first.address).toHaveLength(58)
    })
})

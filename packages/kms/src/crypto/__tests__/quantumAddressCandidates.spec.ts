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

import { describe, test, expect, vi } from 'vitest'
import { indicesToAlgo25Seed } from '../algo25-utils'
import { mnemonicWordsToIndices } from '../mnemonic-indices'
import { quantumAddressCandidates } from '../quantumAddressCandidates'
import { getPQProvider } from '../pq'
import { fakeQuantumChain } from '../../__tests__/fakeQuantumChain'

// THROWAWAY TEST VECTOR — published in source; NEVER fund it.
const TEST_MNEMONIC =
    'evoke unique jaguar rapid silent sister kingdom farm anger brother begin fluid brave sister mixture wedding suffer spin spatial combine ginger neutral lunch absorb upset'

const seedFromMnemonic = (mnemonic: string): Uint8Array =>
    indicesToAlgo25Seed(mnemonicWordsToIndices(mnemonic.split(' '))!)

const addressFor = (keygenSeed: Uint8Array): string =>
    fakeQuantumChain.addressFromPublicKey(
        getPQProvider().generateKeypairFromSeed(keygenSeed).publicKey,
    )

describe('quantumAddressCandidates', () => {
    test('returns both derivations for a mnemonic, canonical first', () => {
        const entropy = seedFromMnemonic(TEST_MNEMONIC)

        const candidates = quantumAddressCandidates(entropy, fakeQuantumChain)

        expect(candidates).toEqual([
            {
                derivation: 'pqk1',
                address: addressFor(fakeQuantumChain.deriveKeygenSeed(entropy)),
            },
            { derivation: 'legacy', address: addressFor(entropy) },
        ])
    })

    test('does not mutate the caller entropy', () => {
        const entropy = seedFromMnemonic(TEST_MNEMONIC)
        const copy = Uint8Array.from(entropy)

        quantumAddressCandidates(entropy, fakeQuantumChain)

        expect(entropy).toEqual(copy)
    })

    test('zeroes both generated Falcon secret keys before returning', () => {
        // Only the public halves are used; the secret halves are real Falcon
        // keys the engine hands back and nothing else references — leaving
        // them unzeroed is heap garbage on the mnemonic-import path.
        const entropy = seedFromMnemonic(TEST_MNEMONIC)
        const provider = getPQProvider()
        const spy = vi.spyOn(provider, 'generateKeypairFromSeed')

        quantumAddressCandidates(entropy, fakeQuantumChain)

        expect(spy).toHaveBeenCalledTimes(2)
        for (const { secretKey } of spy.mock.results.map(r => r.value)) {
            expect(secretKey.every((byte: number) => byte === 0)).toBe(true)
        }

        spy.mockRestore()
    })
})

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
import { seedFromMnemonic } from 'algosdk'
import { quantumAddressCandidates } from '../quantumAddressCandidates'
import { getPQProvider } from '../pq'

// THROWAWAY TEST VECTOR — same as algo25-integration.test.ts; NEVER fund it.
const TEST_MNEMONIC =
    'evoke unique jaguar rapid silent sister kingdom farm anger brother begin fluid brave sister mixture wedding suffer spin spatial combine ginger neutral lunch absorb upset'

// Both addresses were independently verified outside this codebase (algokey
// for canonical, the pre-PERA-4972 minting path for legacy) — never compute
// these through `quantumAddressCandidates` itself, or a wrong derivation and
// its "expected" value drift together with no test able to notice.
const CANONICAL_ADDRESS =
    'H325AXRDHRSZU5727LVZKTKYJVRRGD2MNUXVSPUONMSPTRCXQLWIU36CLI'
const LEGACY_ADDRESS =
    'TQLMWJPC7FZQ2EE7HWCWODSGZPCCESJHQIH3VEGKKJ23YFSFCD4Y662IOU'

describe('quantumAddressCandidates', () => {
    test('returns both derivations for a mnemonic, canonical first', () => {
        const entropy = seedFromMnemonic(TEST_MNEMONIC)

        const candidates = quantumAddressCandidates(entropy)

        expect(candidates).toEqual([
            { derivation: 'pqk1', address: CANONICAL_ADDRESS },
            { derivation: 'legacy', address: LEGACY_ADDRESS },
        ])
    })

    test('does not mutate the caller entropy', () => {
        const entropy = seedFromMnemonic(TEST_MNEMONIC)
        const copy = Uint8Array.from(entropy)

        quantumAddressCandidates(entropy)

        expect(entropy).toEqual(copy)
    })

    test('zeroes both generated Falcon secret keys before returning', () => {
        // Only the public halves are used; the secret halves are real Falcon
        // keys the engine hands back and nothing else references — leaving
        // them unzeroed is heap garbage on the mnemonic-import path.
        const entropy = seedFromMnemonic(TEST_MNEMONIC)
        const provider = getPQProvider()
        const spy = vi.spyOn(provider, 'generateKeypairFromSeed')

        quantumAddressCandidates(entropy)

        expect(spy).toHaveBeenCalledTimes(2)
        for (const { secretKey } of spy.mock.results.map(r => r.value)) {
            expect(secretKey.every((byte: number) => byte === 0)).toBe(true)
        }

        spy.mockRestore()
    })
})

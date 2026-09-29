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
import { quantumAddressCandidates } from '@perawallet/wallet-core-kms'
import { algorandAddressCodec } from '../address-codec'
import { algorandQuantumDerivation } from '../quantum'

// THROWAWAY TEST VECTOR — published in source; NEVER fund it.
const TEST_MNEMONIC =
    'evoke unique jaguar rapid silent sister kingdom farm anger brother begin fluid brave sister mixture wedding suffer spin spatial combine ginger neutral lunch absorb upset'

// Both addresses were independently verified outside this codebase (algokey
// for canonical, the pre-canonical minting path for legacy) — never compute
// these through the code under test, or a wrong derivation and its "expected"
// value drift together with no test able to notice.
const CANONICAL_ADDRESS =
    'H325AXRDHRSZU5727LVZKTKYJVRRGD2MNUXVSPUONMSPTRCXQLWIU36CLI'
const LEGACY_ADDRESS =
    'TQLMWJPC7FZQ2EE7HWCWODSGZPCCESJHQIH3VEGKKJ23YFSFCD4Y662IOU'

describe('algorandQuantumDerivation', () => {
    test('gives kms the algokey-compatible canonical and the legacy address for a mnemonic', () => {
        const candidates = quantumAddressCandidates(
            seedFromMnemonic(TEST_MNEMONIC),
            algorandQuantumDerivation,
        )

        expect(candidates).toEqual([
            { derivation: 'pqk1', address: CANONICAL_ADDRESS },
            { derivation: 'legacy', address: LEGACY_ADDRESS },
        ])
    })

    test('encodes a Falcon key to the same address as the codec does for its scheme', () => {
        const publicKey = new Uint8Array(1793).fill(7)

        expect(algorandQuantumDerivation.addressFromPublicKey(publicKey)).toBe(
            algorandAddressCodec.fromPublicKey(publicKey, {
                scheme: 'falcon-1024',
                networkId: 'mainnet',
            }),
        )
    })
})

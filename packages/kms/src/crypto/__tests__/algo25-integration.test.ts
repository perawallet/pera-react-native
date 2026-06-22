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

import { describe, test, expect } from 'vitest'
import nacl from 'tweetnacl'
import { seedFromMnemonic } from '@algorandfoundation/algokit-utils/algo25'
import { encodeAddress } from '@algorandfoundation/algokit-utils'

/**
 * Integration test for Algo25 (standard Algorand 25-word mnemonic) key derivation.
 * Uses a known test vector — mnemonic -> seed -> Ed25519 keypair -> Algorand address.
 *
 * THROWAWAY TEST VECTOR — published in source; NEVER fund EXPECTED_ADDRESS.
 */

const TEST_MNEMONIC =
    'evoke unique jaguar rapid silent sister kingdom farm anger brother begin fluid brave sister mixture wedding suffer spin spatial combine ginger neutral lunch absorb upset'

const EXPECTED_ADDRESS =
    'T2A7FPKQ3YON2JT5A5CSN4JWNDMUGJY6WX4H6HEH2UPKWSPSPBG5O7X4UM'

describe('Algo25 integration', () => {
    test('derives the expected address from a known 25-word mnemonic', () => {
        const seed = seedFromMnemonic(TEST_MNEMONIC)
        const keyPair = nacl.sign.keyPair.fromSeed(seed)
        const address = encodeAddress(keyPair.publicKey)

        expect(address).toBe(EXPECTED_ADDRESS)
    })

    test('round-trips: seed -> address produces a deterministic result', () => {
        const seed = seedFromMnemonic(TEST_MNEMONIC)
        const keyPair1 = nacl.sign.keyPair.fromSeed(seed)
        const address1 = encodeAddress(keyPair1.publicKey)

        const seed2 = seedFromMnemonic(TEST_MNEMONIC)
        const keyPair2 = nacl.sign.keyPair.fromSeed(seed2)
        const address2 = encodeAddress(keyPair2.publicKey)

        expect(address1).toBe(address2)
    })

    test('signature produced from derived key is verifiable', () => {
        const seed = seedFromMnemonic(TEST_MNEMONIC)
        const keyPair = nacl.sign.keyPair.fromSeed(seed)
        const data = new Uint8Array([1, 2, 3, 4, 5])
        const signature = nacl.sign.detached(data, keyPair.secretKey)

        expect(
            nacl.sign.detached.verify(data, signature, keyPair.publicKey),
        ).toBe(true)
    })
})

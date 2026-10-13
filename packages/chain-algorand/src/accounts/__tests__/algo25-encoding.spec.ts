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
import { describe, expect, test } from 'vitest'
import nacl from 'tweetnacl'
import { mnemonicFromSeed, seedFromMnemonic } from 'algosdk'
import {
    algo25SeedToIndices,
    indicesToAlgo25Seed,
    mnemonicIndexToWord,
    mnemonicWordsToIndices,
} from '@perawallet/wallet-core-kms'
import { algorandAddressCodec } from '../address-codec'

// THROWAWAY TEST VECTOR, published in source; NEVER fund EXPECTED_ADDRESS.
const TEST_MNEMONIC =
    'evoke unique jaguar rapid silent sister kingdom farm anger brother begin fluid brave sister mixture wedding suffer spin spatial combine ginger neutral lunch absorb upset'
const EXPECTED_ADDRESS =
    'T2A7FPKQ3YON2JT5A5CSN4JWNDMUGJY6WX4H6HEH2UPKWSPSPBG5O7X4UM'

const SEEDS: Record<string, Uint8Array> = {
    incrementing: Uint8Array.from(
        { length: 32 },
        (_, i) => (i * 13 + 5) & 0xff,
    ),
    'all-zero': new Uint8Array(32),
    'all-ff': new Uint8Array(32).fill(0xff),
}

describe('algo25 seed encoding against the Algorand SDK', () => {
    test.each(Object.entries(SEEDS))(
        'algo25SeedToIndices matches the mnemonicFromSeed word path for %s seed',
        (_label, seed) => {
            const viaWords = mnemonicWordsToIndices(
                mnemonicFromSeed(seed).split(' '),
            )
            expect(Array.from(algo25SeedToIndices(seed))).toEqual(
                Array.from(viaWords!),
            )
        },
    )

    test.each(Object.entries(SEEDS))(
        'indicesToAlgo25Seed matches the seedFromMnemonic word path for %s seed',
        (_label, seed) => {
            const indices = algo25SeedToIndices(seed)
            const viaWords = seedFromMnemonic(
                Array.from(indices, mnemonicIndexToWord).join(' '),
            )
            expect(Array.from(indicesToAlgo25Seed(indices))).toEqual(
                Array.from(viaWords),
            )
        },
    )
})

describe('algo25 address', () => {
    test('a known mnemonic derives the expected address through the codec', () => {
        const seed = indicesToAlgo25Seed(
            mnemonicWordsToIndices(TEST_MNEMONIC.split(' '))!,
        )
        const { publicKey } = nacl.sign.keyPair.fromSeed(seed)

        expect(
            algorandAddressCodec.fromPublicKey(publicKey, {
                scheme: 'ed25519',
                networkId: 'mainnet',
            }),
        ).toBe(EXPECTED_ADDRESS)
    })

    test('the SDK decodes the same mnemonic to the same seed', () => {
        const seed = indicesToAlgo25Seed(
            mnemonicWordsToIndices(TEST_MNEMONIC.split(' '))!,
        )

        expect(Array.from(seed)).toEqual(
            Array.from(seedFromMnemonic(TEST_MNEMONIC)),
        )
    })
})

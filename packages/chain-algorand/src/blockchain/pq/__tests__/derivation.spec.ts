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

import { describe, expect, test } from 'vitest'
import { generateKey } from 'falcon-1024'
import { derivePQKeygenSeed } from '../derivation'
import { deriveQuantumAddress } from '../quantumAdapter'

// go-algorand `cmd/algokey/pq_test.go` pins this vector: entropy = bytes 1..32.
// It is an EXTERNAL oracle on purpose — every other quantum fixture in this
// repo derives its expectation through the same provider as the code under
// test, which is exactly how a non-canonical derivation shipped unnoticed.
const GO_ALGORAND_ENTROPY = Uint8Array.from({ length: 32 }, (_, i) => i + 1)
const GO_ALGORAND_ADDRESS =
    'ZEJ4BLG3XWAUUZQGCEDJLYIC6D2NCWHRSX5DJMDPE54PXXR7G3PCQTARXU'

describe('derivePQKeygenSeed', () => {
    test('reproduces go-algorand algokey pq for its published vector', () => {
        const seed = derivePQKeygenSeed(GO_ALGORAND_ENTROPY)
        const { publicKey } = generateKey(seed)

        expect(deriveQuantumAddress(publicKey)).toBe(GO_ALGORAND_ADDRESS)
    })

    test('returns a 32-byte seed', () => {
        expect(derivePQKeygenSeed(GO_ALGORAND_ENTROPY)).toHaveLength(32)
    })

    test('is not the identity: the raw entropy is NOT the keygen seed', () => {
        // The bug this whole change fixes. Also a tripwire: if keystore-core
        // ever adds a quantum case to `withSeed`, feeding it a pre-derived seed
        // would double-derive, and this asserts the two are distinguishable.
        expect(derivePQKeygenSeed(GO_ALGORAND_ENTROPY)).not.toEqual(
            GO_ALGORAND_ENTROPY,
        )
    })

    test('defaults to falcon-1024', () => {
        // Only one scheme exists today, so true cross-scheme separation is not
        // testable yet — this pins the default so adding a second scheme cannot
        // silently move existing accounts.
        expect(derivePQKeygenSeed(GO_ALGORAND_ENTROPY, 'falcon1024')).toEqual(
            derivePQKeygenSeed(GO_ALGORAND_ENTROPY),
        )
    })

    test('does not mutate the caller entropy', () => {
        const entropy = Uint8Array.from(GO_ALGORAND_ENTROPY)
        derivePQKeygenSeed(entropy)

        expect(entropy).toEqual(GO_ALGORAND_ENTROPY)
    })
})

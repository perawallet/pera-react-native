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

import { describe, expect, it } from 'vitest'
import { seedFromMnemonic } from 'algosdk'
import { getPQProvider } from '@perawallet/wallet-core-kms'
import {
    deriveQuantumAddress,
    derivePQKeygenSeed,
} from '@perawallet/wallet-core-blockchain'
import {
    QUANTUM_TEST_ADDRESS,
    QUANTUM_TEST_CANONICAL_ADDRESS,
    QUANTUM_TEST_MNEMONIC,
    QUANTUM_TEST_PUBLIC_KEY,
} from '../quantum'

describe('quantumAccountFixtures', () => {
    it('exposes a 25-word mnemonic', () => {
        expect(QUANTUM_TEST_MNEMONIC.split(' ')).toHaveLength(25)
    })

    it('matches the externally pinned canonical address, not just its own re-derivation', () => {
        // Every other assertion in this file re-derives through the same
        // provider as the fixture itself, so a regression in that provider
        // would pass all of them. This is the one check with an independent
        // anchor — see QUANTUM_TEST_CANONICAL_ADDRESS in ../quantum.ts.
        expect(QUANTUM_TEST_ADDRESS).toBe(QUANTUM_TEST_CANONICAL_ADDRESS)
    })

    it('derives a valid 58-char Algorand address deterministically', () => {
        // Arrange
        expect(QUANTUM_TEST_ADDRESS).toHaveLength(58)

        // Act / Assert: the exported address must match re-deriving from the exported pubkey
        expect(QUANTUM_TEST_ADDRESS).toBe(
            deriveQuantumAddress(QUANTUM_TEST_PUBLIC_KEY),
        )
    })

    it('stays in sync with an end-to-end re-derivation from the mnemonic', () => {
        // Arrange
        const seed = seedFromMnemonic(QUANTUM_TEST_MNEMONIC)

        // Act
        const { publicKey } = getPQProvider().generateKeypairFromSeed(
            derivePQKeygenSeed(seed),
        )

        // Assert
        expect(new Uint8Array(publicKey)).toEqual(
            new Uint8Array(QUANTUM_TEST_PUBLIC_KEY),
        )
        expect(deriveQuantumAddress(publicKey)).toBe(QUANTUM_TEST_ADDRESS)
    })
})

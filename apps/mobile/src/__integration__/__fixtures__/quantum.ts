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

import { seedFromMnemonic } from 'algosdk'
import { getPQProvider } from '@perawallet/wallet-core-kms'
import {
    deriveQuantumAddress,
    derivePQKeygenSeed,
} from '@perawallet/wallet-core-blockchain'
import { ALGO25_TEST_MNEMONIC } from './onboarding'

/**
 * Shared quantum-account test fixture. The quantum mnemonic format IS algo25
 * (24 data words + 1 checksum word), so we reuse the pinned algo25 vector and
 * derive the real Falcon public key / address through the same PQ provider
 * the app uses (`useQuantum`). Every quantum test suite should import these.
 *
 * @example
 * server.use(mockAlgodAccountInformation({ address: QUANTUM_TEST_ADDRESS, response: { amount: 5_000_000 } }))
 */
export const QUANTUM_TEST_MNEMONIC = ALGO25_TEST_MNEMONIC

// Canonical (algokey-compatible) address for QUANTUM_TEST_MNEMONIC, pinned
// independently of this file's own derivation — same role as ALGO25_TEST_ADDRESS
// in ./onboarding.ts. Without it nothing here catches a derivation regression:
// QUANTUM_TEST_ADDRESS below and its guard spec would drift together silently.
export const QUANTUM_TEST_CANONICAL_ADDRESS =
    'H325AXRDHRSZU5727LVZKTKYJVRRGD2MNUXVSPUONMSPTRCXQLWIU36CLI'

export const QUANTUM_TEST_PUBLIC_KEY = getPQProvider().generateKeypairFromSeed(
    derivePQKeygenSeed(seedFromMnemonic(QUANTUM_TEST_MNEMONIC)),
).publicKey

export const QUANTUM_TEST_ADDRESS = deriveQuantumAddress(
    QUANTUM_TEST_PUBLIC_KEY,
)

// Legacy-derivation address for the same mnemonic — Falcon seeded with the
// raw entropy instead of the canonical PQK1 hash (see PERA-4972). The dual-
// probe import path needs both candidate addresses mockable on chain.
export const QUANTUM_TEST_LEGACY_PUBLIC_KEY =
    getPQProvider().generateKeypairFromSeed(
        seedFromMnemonic(QUANTUM_TEST_MNEMONIC),
    ).publicKey

export const QUANTUM_TEST_LEGACY_ADDRESS = deriveQuantumAddress(
    QUANTUM_TEST_LEGACY_PUBLIC_KEY,
)

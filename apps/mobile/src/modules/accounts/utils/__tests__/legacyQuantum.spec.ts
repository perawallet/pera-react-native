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

// The global setup mocks for these modules omit `isQuantumAccount`,
// `AccountTypes.quantum` and `PQ_DERIVATION_CANONICAL` entirely, so this file
// needs the real implementations rather than the app-wide stubs.
vi.mock('@perawallet/wallet-core-accounts', async importOriginal => {
    const actual =
        await importOriginal<
            typeof import('@perawallet/wallet-core-accounts')
        >()
    return { ...actual }
})

vi.mock('@perawallet/wallet-core-kms', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@perawallet/wallet-core-kms')>()
    return { ...actual }
})

import {
    AccountTypes,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { isLegacyQuantumChild } from '../legacyQuantum'

const QUANTUM_ACCOUNT: WalletAccount = {
    id: 'quantum-account-1',
    type: AccountTypes.quantum,
    address: 'QUANTUMADDRESS',
    keyPairId: 'seed-1-quantum',
}

const WATCH_ACCOUNT: WalletAccount = {
    id: 'watch-account-1',
    type: AccountTypes.watch,
    address: 'WATCHADDRESS',
}

describe('isLegacyQuantumChild', () => {
    test('is true when the child is stamped legacy', () => {
        const getKey = vi.fn(() => ({ metadata: { pqDerivation: 'legacy' } }))

        expect(isLegacyQuantumChild(getKey as never, QUANTUM_ACCOUNT)).toBe(
            true,
        )
    })

    test('is false when the child is stamped canonical', () => {
        const getKey = vi.fn(() => ({ metadata: { pqDerivation: 'pqk1' } }))

        expect(isLegacyQuantumChild(getKey as never, QUANTUM_ACCOUNT)).toBe(
            false,
        )
    })

    // The failure direction that hurts: a child that a migration failed to
    // stamp must still read as legacy, not silently as canonical.
    test('fails closed to legacy when the derivation marker is undefined', () => {
        const getKey = vi.fn(() => ({ metadata: {} }))

        expect(isLegacyQuantumChild(getKey as never, QUANTUM_ACCOUNT)).toBe(
            true,
        )
    })

    test('fails closed to legacy when the key has no metadata at all', () => {
        const getKey = vi.fn(() => ({}))

        expect(isLegacyQuantumChild(getKey as never, QUANTUM_ACCOUNT)).toBe(
            true,
        )
    })

    test('is false for a non-quantum account, regardless of metadata', () => {
        const getKey = vi.fn(() => ({ metadata: {} }))

        expect(isLegacyQuantumChild(getKey as never, WATCH_ACCOUNT)).toBe(false)
        expect(getKey).not.toHaveBeenCalled()
    })
})

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

import { describe, expect, it } from 'vitest'
import {
    AccountTypes,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import type { PeraTransaction } from '@perawallet/wallet-core-blockchain'
import { containsQuantumSigner } from '../containsQuantumSigner'

const addr = (s: string) => ({ toString: () => s })

const makeTxn = (sender: string): PeraTransaction =>
    ({ sender: addr(sender) }) as unknown as PeraTransaction

const algo25 = (
    address: string,
    overrides: Partial<WalletAccount> = {},
): WalletAccount =>
    ({
        id: address,
        address,
        type: AccountTypes.algo25,
        keyPairId: 'kp',
        ...overrides,
    }) as WalletAccount

const quantum = (
    address: string,
    overrides: Partial<WalletAccount> = {},
): WalletAccount =>
    ({
        id: address,
        address,
        type: AccountTypes.quantum,
        keyPairId: 'kp-quantum',
        ...overrides,
    }) as WalletAccount

describe('containsQuantumSigner', () => {
    it('returns true when the sender is a quantum account (not rekeyed)', () => {
        const accounts = [quantum('QUANTUM_ADDR')]

        expect(containsQuantumSigner([makeTxn('QUANTUM_ADDR')], accounts)).toBe(
            true,
        )
    })

    it('returns true when the sender is rekeyed to a quantum account held in the store', () => {
        const accounts = [
            algo25('ALGO25_ADDR', { rekeyAddress: 'QUANTUM_ADDR' }),
            quantum('QUANTUM_ADDR'),
        ]

        expect(containsQuantumSigner([makeTxn('ALGO25_ADDR')], accounts)).toBe(
            true,
        )
    })

    it('returns false when the sender is a plain algo25 account (no rekey)', () => {
        const accounts = [algo25('ALGO25_ADDR')]

        expect(containsQuantumSigner([makeTxn('ALGO25_ADDR')], accounts)).toBe(
            false,
        )
    })

    it('returns false when the rekey target is not held in the store', () => {
        const accounts = [
            algo25('ALGO25_ADDR', { rekeyAddress: 'MISSING_QUANTUM_ADDR' }),
        ]

        expect(containsQuantumSigner([makeTxn('ALGO25_ADDR')], accounts)).toBe(
            false,
        )
    })

    it('returns false when the sender is not held in the wallet at all', () => {
        const accounts: WalletAccount[] = []

        expect(
            containsQuantumSigner([makeTxn('EXTERNAL_ADDR')], accounts),
        ).toBe(false)
    })

    it('returns true for a mixed group with one quantum sender and one algo25 sender', () => {
        const accounts = [quantum('QUANTUM_ADDR'), algo25('ALGO25_ADDR')]

        expect(
            containsQuantumSigner(
                [makeTxn('ALGO25_ADDR'), makeTxn('QUANTUM_ADDR')],
                accounts,
            ),
        ).toBe(true)
    })
})

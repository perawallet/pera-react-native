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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { Address } from '@algorandfoundation/algokit-utils/common'
import {
    Transaction,
    TransactionType,
    encodeTransaction,
} from '@algorandfoundation/algokit-utils/transact'
import { encodeToBase64 } from '@perawallet/wallet-core-shared'

import { useArc0001Resolver } from '../useArc0001Resolver'

const addrA = new Address(new Uint8Array(32).fill(1)).toString()
const addrB = new Address(new Uint8Array(32).fill(2)).toString()

const baseParams = {
    fee: 1000n,
    firstValid: 1000n,
    lastValid: 2000n,
    genesisId: 'mainnet-v1.0',
    genesisHash: new Uint8Array(32).fill(0xab),
}

const buildPaymentTxnB64 = (sender: string): string => {
    const tx = new Transaction({
        type: TransactionType.Payment,
        sender: new Address(Address.fromString(sender).publicKey),
        ...baseParams,
        payment: {
            receiver: new Address(Address.fromString(addrB).publicKey),
            amount: 1n,
        },
    })
    return encodeToBase64(encodeTransaction(tx))
}

const mockSigningAccounts = vi.fn<() => Array<{ address: string }>>(() => [
    { address: addrA },
])

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useSigningAccounts: () => mockSigningAccounts(),
    useAllAccounts: () => mockSigningAccounts(),
    isMultisigAccount: () => false,
}))

describe('useArc0001Resolver', () => {
    beforeEach(() => {
        mockSigningAccounts.mockReturnValue([{ address: addrA }])
    })

    it('returns a function that defaults signableAddresses to the wallet`s signing accounts', () => {
        const { result } = renderHook(() => useArc0001Resolver())

        const resolved = result.current({
            transactions: [{ txn: buildPaymentTxnB64(addrA) }],
        })

        expect(resolved.toSign).toHaveLength(1)
        expect(resolved.toSign[0].signer).toEqual({
            kind: 'single',
            address: addrA,
        })
    })

    it('does not gate signers when authorizedAddresses is omitted', () => {
        // Wallet has A and B; no authorizedAddresses → both are signable.
        mockSigningAccounts.mockReturnValue([
            { address: addrA },
            { address: addrB },
        ])
        const { result } = renderHook(() => useArc0001Resolver())

        const resolved = result.current({
            transactions: [
                { txn: buildPaymentTxnB64(addrA) },
                { txn: buildPaymentTxnB64(addrB) },
            ],
        })

        expect(resolved.toSign).toHaveLength(2)
    })

    it('throws 4100 when an authorized set is supplied and a local sender is outside it', () => {
        mockSigningAccounts.mockReturnValue([
            { address: addrA },
            { address: addrB },
        ])
        const { result } = renderHook(() => useArc0001Resolver())

        expect(() =>
            result.current(
                { transactions: [{ txn: buildPaymentTxnB64(addrB) }] },
                { authorizedAddresses: new Set([addrA]) },
            ),
        ).toThrow(
            expect.objectContaining({
                name: 'Arc0001Error',
                code: 4100,
            }),
        )
    })

    it('honors a tighter maxTransactions override', () => {
        const { result } = renderHook(() => useArc0001Resolver())
        const txns = Array.from({ length: 3 }, () => ({
            txn: buildPaymentTxnB64(addrA),
        }))

        expect(() =>
            result.current({ transactions: txns }, { maxTransactions: 2 }),
        ).toThrow(
            expect.objectContaining({
                code: 4201,
            }),
        )
    })
})

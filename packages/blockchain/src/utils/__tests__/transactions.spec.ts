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

import { describe, it, expect } from 'vitest'
import {
    mapToDisplayableTransaction,
    getTransactionType,
    isPaymentTransaction,
    isAssetTransferTransaction,
    isAssetConfigTransaction,
    isAssetFreezeTransaction,
    isKeyRegistrationTransaction,
    isAppCallTransaction,
} from '../transactions'
import { TransactionType } from '@algorandfoundation/algokit-utils/transact'
import { encodeAddress } from '@algorandfoundation/algokit-utils'
import type { PeraTransaction, PeraDisplayableTransaction } from '../../models'

// Helper to create mock Address
const mockAddress = (byteVal = 1) => ({
    publicKey: new Uint8Array(32).fill(byteVal),
})
// Helper to create mock AlgoAmount/bigint
const mockFee = 1000n

describe('transactions utils', () => {
    describe('mapToDisplayableTransaction', () => {
        it('should return null for unknown transaction type', () => {
            const tx = { type: TransactionType.Unknown } as any
            expect(mapToDisplayableTransaction(tx)).toBeNull()
        })

        it('should map common fields correctly', () => {
            const tx = {
                type: TransactionType.Payment, // Must be a valid type to enter switch or at least pass check
                payment: {
                    // Mock payment prop to avoid error access
                    amount: 5000n,
                    receiver: mockAddress(2),
                },
                fee: mockFee,
                firstValid: 100n,
                lastValid: 200n,
                sender: mockAddress(1),
                genesisId: 'testnet-v1.0',
                note: new Uint8Array([1, 2, 3]),
                rekeyTo: mockAddress(5), // RekeyTo should stay as object
                receiver: mockAddress(2),
                amount: 5000n,
            } as any

            const result = mapToDisplayableTransaction(tx as PeraTransaction)

            expect(result).not.toBeNull()
            expect(result?.fee).toBe(mockFee)
            expect(result?.firstValid).toBe(100n)
            expect(result?.lastValid).toBe(200n)
            expect(result?.sender).toBe(encodeAddress(mockAddress(1).publicKey)) // Correctly expects string
            expect(result?.genesisId).toBe('testnet-v1.0')
            expect(result?.note).toEqual(new Uint8Array([1, 2, 3]))
            expect(result?.rekeyTo).toEqual(mockAddress(5)) // Expect object
        })

        it('should map Payment transaction', () => {
            const tx = {
                type: TransactionType.Payment,
                fee: 1000n,
                firstValid: 1n,
                lastValid: 2n,
                sender: mockAddress(1),
                payment: {
                    amount: 5000n,
                    receiver: mockAddress(2),
                    closeRemainderTo: mockAddress(3),
                },
            } as any

            const result = mapToDisplayableTransaction(tx as PeraTransaction)

            expect(result?.txType).toBe('pay')
            expect(result?.paymentTransaction).toBeDefined()
            expect(result?.paymentTransaction?.amount).toBe(5000n)
            expect(result?.paymentTransaction?.receiver).toBe(
                encodeAddress(mockAddress(2).publicKey),
            ) // string
            expect(result?.paymentTransaction?.closeRemainderTo).toBe(
                encodeAddress(mockAddress(3).publicKey),
            ) // string
        })

        it('should map Asset Transfer transaction', () => {
            const tx = {
                type: TransactionType.AssetTransfer,
                fee: 1000n,
                firstValid: 1n,
                lastValid: 2n,
                sender: mockAddress(1),
                assetTransfer: {
                    assetId: 123n,
                    amount: 50n,
                    receiver: mockAddress(2),
                    closeRemainderTo: mockAddress(3), // mapped to closeTo
                    assetSender: mockAddress(4),
                },
            } as any

            const result = mapToDisplayableTransaction(tx as PeraTransaction)

            expect(result?.txType).toBe('axfer')
            expect(result?.assetTransferTransaction).toBeDefined()
            expect(result?.assetTransferTransaction?.assetId).toBe(123n)
            expect(result?.assetTransferTransaction?.amount).toBe(50n)
            expect(result?.assetTransferTransaction?.receiver).toBe(
                encodeAddress(mockAddress(2).publicKey),
            ) // string
            expect(result?.assetTransferTransaction?.closeTo).toBe(
                encodeAddress(mockAddress(3).publicKey),
            ) // string
            expect(result?.assetTransferTransaction?.sender).toBe(
                encodeAddress(mockAddress(4).publicKey),
            ) // string
        })

        it('should map App Call transaction', () => {
            const tx = {
                type: TransactionType.AppCall,
                fee: 1000n,
                firstValid: 1n,
                lastValid: 2n,
                sender: mockAddress(1),
                appCall: {
                    appId: 99n,
                    onComplete: 'noop',
                    args: [new Uint8Array([1])],
                    accountReferences: [mockAddress(2)],
                    appReferences: [10n],
                    assetReferences: [20n],
                    globalStateSchema: { numByteSlices: 1, numUints: 2 },
                    localStateSchema: { numByteSlices: 3, numUints: 4 },
                },
            } as any

            const result = mapToDisplayableTransaction(tx as PeraTransaction)

            expect(result?.txType).toBe('appl')
            expect(result?.applicationTransaction).toBeDefined()
            expect(result?.applicationTransaction?.applicationId).toBe(99n)
            expect(
                result?.applicationTransaction?.applicationArgs,
            ).toHaveLength(1)
            expect(result?.applicationTransaction?.accounts).toHaveLength(1)
            expect(result?.applicationTransaction?.accounts?.[0]).toEqual(
                mockAddress(2),
            ) // Expect object
            expect(result?.applicationTransaction?.foreignApps).toHaveLength(1)
            expect(result?.applicationTransaction?.foreignAssets).toHaveLength(
                1,
            )
            expect(
                result?.applicationTransaction?.globalStateSchema
                    ?.numByteSlices,
            ).toBe(1)
            expect(
                result?.applicationTransaction?.globalStateSchema?.numUints,
            ).toBe(2)
        })
    })

    describe('isPaymentTransaction helper', () => {
        it('should return true for payment type', () => {
            const tx = {
                txType: 'pay',
                paymentTransaction: {},
            } as PeraDisplayableTransaction
            expect(isPaymentTransaction(tx)).toBe(true)
        })

        it('should return false for other types', () => {
            const tx = { txType: 'axfer' } as PeraDisplayableTransaction
            expect(isPaymentTransaction(tx)).toBe(false)
        })
    })

    describe('getTransactionType', () => {
        it('should return correct PeraTransactionType', () => {
            expect(getTransactionType({ txType: 'pay' } as any)).toBe('payment')
            expect(getTransactionType({ txType: 'axfer' } as any)).toBe(
                'asset-transfer',
            )
            expect(getTransactionType({ txType: 'acfg' } as any)).toBe(
                'asset-config',
            )
            expect(getTransactionType({ txType: 'afrz' } as any)).toBe(
                'asset-freeze',
            )
            expect(getTransactionType({ txType: 'keyreg' } as any)).toBe(
                'key-registration',
            )
            expect(getTransactionType({ txType: 'appl' } as any)).toBe(
                'app-call',
            )
            expect(getTransactionType({ txType: 'stpf' } as any)).toBe(
                'state-proof',
            )
            expect(getTransactionType({ txType: 'hb' } as any)).toBe(
                'heartbeat',
            )
            expect(getTransactionType({ txType: 'other' } as any)).toBe(
                'unknown',
            )
        })
    })
})

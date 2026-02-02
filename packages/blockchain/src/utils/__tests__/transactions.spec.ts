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
    getAssetTransferType,
    getAssetConfigType,
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

    describe('mapToDisplayableTransaction additional types', () => {
        it('should map Asset Config transaction', () => {
            const tx = {
                type: TransactionType.AssetConfig,
                fee: 1000n,
                firstValid: 1n,
                lastValid: 2n,
                sender: mockAddress(1),
                assetConfig: {
                    assetId: 100n,
                    assetName: 'Test Asset',
                    unitName: 'TST',
                    total: 1000000n,
                    decimals: 6,
                    defaultFrozen: false,
                    manager: mockAddress(3),
                    reserve: mockAddress(4),
                    freeze: mockAddress(5),
                    clawback: mockAddress(6),
                    url: 'https://test.com',
                    metadataHash: new Uint8Array([1, 2, 3]),
                },
            } as any

            const result = mapToDisplayableTransaction(tx as PeraTransaction)

            expect(result?.txType).toBe('acfg')
            expect(result?.assetConfigTransaction).toBeDefined()
            expect(result?.assetConfigTransaction?.assetId).toBe(100n)
            expect(result?.assetConfigTransaction?.params?.name).toBe(
                'Test Asset',
            )
            expect(result?.assetConfigTransaction?.params?.unitName).toBe('TST')
            expect(result?.assetConfigTransaction?.params?.manager).toBe(
                encodeAddress(mockAddress(3).publicKey),
            )
            expect(result?.assetConfigTransaction?.params?.reserve).toBe(
                encodeAddress(mockAddress(4).publicKey),
            )
        })

        it('should map Asset Freeze transaction', () => {
            const tx = {
                type: TransactionType.AssetFreeze,
                fee: 1000n,
                firstValid: 1n,
                lastValid: 2n,
                sender: mockAddress(1),
                assetFreeze: {
                    assetId: 200n,
                    freezeTarget: mockAddress(2),
                    frozen: true,
                },
            } as any

            const result = mapToDisplayableTransaction(tx as PeraTransaction)

            expect(result?.txType).toBe('afrz')
            expect(result?.assetFreezeTransaction).toBeDefined()
            expect(result?.assetFreezeTransaction?.assetId).toBe(200n)
            expect(result?.assetFreezeTransaction?.address).toBe(
                encodeAddress(mockAddress(2).publicKey),
            )
            expect(result?.assetFreezeTransaction?.newFreezeStatus).toBe(true)
        })

        it('should map Key Registration transaction', () => {
            const tx = {
                type: TransactionType.KeyRegistration,
                fee: 1000n,
                firstValid: 1n,
                lastValid: 2n,
                sender: mockAddress(1),
                keyRegistration: {
                    voteFirst: 1000n,
                    voteLast: 2000n,
                    voteKeyDilution: 10n,
                    selectionKey: new Uint8Array([1]),
                    voteKey: new Uint8Array([2]),
                    nonParticipation: false,
                },
            } as any

            const result = mapToDisplayableTransaction(tx as PeraTransaction)

            expect(result?.txType).toBe('keyreg')
            expect(result?.keyregTransaction).toBeDefined()
            expect(result?.keyregTransaction?.voteFirstValid).toBe(1000n)
            expect(result?.keyregTransaction?.voteLastValid).toBe(2000n)
            expect(
                result?.keyregTransaction?.selectionParticipationKey,
            ).toEqual(new Uint8Array([1]))
        })

        it('should map StateProof transaction', () => {
            const tx = {
                type: TransactionType.StateProof,
                fee: 1000n,
                firstValid: 1n,
                lastValid: 2n,
                sender: mockAddress(1),
            } as any
            const result = mapToDisplayableTransaction(tx as PeraTransaction)
            expect(result?.txType).toBe('stpf')
        })

        it('should map Heartbeat transaction', () => {
            const tx = {
                type: TransactionType.Heartbeat,
                fee: 1000n,
                firstValid: 1n,
                lastValid: 2n,
                sender: mockAddress(1),
            } as any
            const result = mapToDisplayableTransaction(tx as PeraTransaction)
            expect(result?.txType).toBe('hb')
        })

        it('should fallback to pay for unknown mapped type but valid generic type', () => {
            // This hits the default case in mapTransactionType if we can force a type that isn't in screen
            // But TransactionType enum is constrained. We can cast.
            const tx = {
                type: 999 as unknown as TransactionType,
                fee: 1000n,
                sender: mockAddress(1),
            } as any
            const result = mapToDisplayableTransaction(tx as PeraTransaction)
            // It returns null at the top of mapToDisplayableTransaction check for Unknown (0).
            // If we pass a random number that is not 0 but not in switch of mapTransactionType?
            // mapToDisplayableTransaction checks `if (tx.type === TransactionType.Unknown) return null`
            // If we pass 999, it proceeds.
            // mapTransactionType(999) -> default 'pay'
            expect(result?.txType).toBe('pay')
        })

        it('should map numeric OnCompletion in AppCall', () => {
            const tx = {
                type: TransactionType.AppCall,
                fee: 1000n,
                sender: mockAddress(1),
                appCall: {
                    appId: 99n,
                    onComplete: 0, // NoOp
                },
            } as any
            const result = mapToDisplayableTransaction(tx as PeraTransaction)
            expect(result?.applicationTransaction?.onCompletion).toBe('noop')

            // Test other values
            const makeTx = (oc: number) =>
                ({
                    type: TransactionType.AppCall,
                    fee: 1000n,
                    sender: mockAddress(1),
                    appCall: { appId: 99n, onComplete: oc },
                }) as any

            expect(
                mapToDisplayableTransaction(makeTx(1))?.applicationTransaction
                    ?.onCompletion,
            ).toBe('optin')
            expect(
                mapToDisplayableTransaction(makeTx(2))?.applicationTransaction
                    ?.onCompletion,
            ).toBe('closeout')
            expect(
                mapToDisplayableTransaction(makeTx(3))?.applicationTransaction
                    ?.onCompletion,
            ).toBe('clear')
            expect(
                mapToDisplayableTransaction(makeTx(4))?.applicationTransaction
                    ?.onCompletion,
            ).toBe('update')
            expect(
                mapToDisplayableTransaction(makeTx(5))?.applicationTransaction
                    ?.onCompletion,
            ).toBe('delete')
            expect(
                mapToDisplayableTransaction(makeTx(99))?.applicationTransaction
                    ?.onCompletion,
            ).toBe('noop') // Default
        })
    })

    describe('getAssetTransferType', () => {
        it('should return unknown if not asset transfer', () => {
            const tx = {
                txType: 'pay',
            } as PeraDisplayableTransaction
            expect(getAssetTransferType(tx)).toBe('unknown')
        })

        it('should return clawback if asset sender is present', () => {
            const tx = {
                txType: 'axfer',
                sender: 'sender-addr',
                assetTransferTransaction: {
                    sender: 'target-addr', // asset sender present
                    receiver: 'receiver-addr',
                    amount: 10n,
                },
            } as PeraDisplayableTransaction
            expect(getAssetTransferType(tx)).toBe('clawback')
        })

        it('should return opt-in for 0 amount self-transfer without close', () => {
            const tx = {
                txType: 'axfer',
                sender: 'addr-1',
                assetTransferTransaction: {
                    receiver: 'addr-1',
                    amount: 0n,
                },
            } as PeraDisplayableTransaction
            expect(getAssetTransferType(tx)).toBe('opt-in')
        })

        it('should return opt-out if close to address is present', () => {
            const tx = {
                txType: 'axfer',
                sender: 'addr-1',
                assetTransferTransaction: {
                    receiver: 'addr-2',
                    amount: 0n,
                    closeTo: 'addr-3',
                },
            } as PeraDisplayableTransaction
            expect(getAssetTransferType(tx)).toBe('opt-out')
        })

        it('should return transfer for standard transfer', () => {
            const tx = {
                txType: 'axfer',
                sender: 'addr-1',
                assetTransferTransaction: {
                    receiver: 'addr-2',
                    amount: 10n,
                },
            } as PeraDisplayableTransaction
            expect(getAssetTransferType(tx)).toBe('transfer')
        })
    })

    describe('getAssetConfigType', () => {
        it('should return update if no config', () => {
            const tx = { txType: 'acfg' } as PeraDisplayableTransaction
            expect(getAssetConfigType(tx)).toBe('update')
        })

        it('should return create if assetId is 0', () => {
            const tx = {
                txType: 'acfg',
                assetConfigTransaction: { assetId: 0n },
            } as PeraDisplayableTransaction
            expect(getAssetConfigType(tx)).toBe('create')
        })

        it('should return destroy if all params undefined', () => {
            const tx = {
                txType: 'acfg',
                assetConfigTransaction: {
                    assetId: 100n,
                    params: {}, // all relevant fields undefined
                },
            } as PeraDisplayableTransaction
            expect(getAssetConfigType(tx)).toBe('destroy')
        })

        it('should return update for normal config change', () => {
            const tx = {
                txType: 'acfg',
                assetConfigTransaction: {
                    assetId: 100n,
                    params: { manager: 'addr-1' },
                },
            } as PeraDisplayableTransaction
            expect(getAssetConfigType(tx)).toBe('update')
        })
    })

    describe('Type Guards', () => {
        it('should validate Asset Transfer', () => {
            expect(
                isAssetTransferTransaction({
                    txType: 'axfer',
                    assetTransferTransaction: {},
                } as any),
            ).toBe(true)
            expect(isAssetTransferTransaction({ txType: 'pay' } as any)).toBe(
                false,
            )
        })

        it('should validate Asset Config', () => {
            expect(
                isAssetConfigTransaction({
                    txType: 'acfg',
                    assetConfigTransaction: {},
                } as any),
            ).toBe(true)
            expect(isAssetConfigTransaction({ txType: 'pay' } as any)).toBe(
                false,
            )
        })

        it('should validate Asset Freeze', () => {
            expect(
                isAssetFreezeTransaction({
                    txType: 'afrz',
                    assetFreezeTransaction: {},
                } as any),
            ).toBe(true)
            expect(isAssetFreezeTransaction({ txType: 'pay' } as any)).toBe(
                false,
            )
        })

        it('should validate Key Registration', () => {
            expect(
                isKeyRegistrationTransaction({ txType: 'keyreg' } as any),
            ).toBe(true)
            expect(isKeyRegistrationTransaction({ txType: 'pay' } as any)).toBe(
                false,
            )
        })

        it('should validate App Call', () => {
            expect(
                isAppCallTransaction({
                    txType: 'appl',
                    applicationTransaction: {},
                } as any),
            ).toBe(true)
            expect(isAppCallTransaction({ txType: 'pay' } as any)).toBe(false)
        })
    })
})

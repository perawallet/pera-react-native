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
import {
    AccountTypes,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { createPaymentSource } from '../createPaymentSource'
import { createMinFeeResolver } from '../minFeeResolver'

const mockEncoded = new Uint8Array([1, 2, 3])

const FIXTURE_ACCOUNTS: WalletAccount[] = [
    {
        id: 'q',
        address: 'QSENDER',
        type: AccountTypes.quantum,
        keyPairId: 'kp-q',
    },
    {
        id: 'a',
        address: 'ASENDER',
        type: AccountTypes.algo25,
        keyPairId: 'kp-a',
    },
    {
        id: 'r',
        address: 'REKEYED',
        type: AccountTypes.algo25,
        keyPairId: 'kp-r',
        rekeyAddress: 'QSENDER',
    },
    {
        id: 'rq',
        address: 'QREKEYED',
        type: AccountTypes.quantum,
        keyPairId: 'kp-rq',
        rekeyAddress: 'ASENDER',
    },
] as WalletAccount[]

const resolveMinFeeForSender = createMinFeeResolver({
    getAccounts: () => FIXTURE_ACCOUNTS,
    getSuggestedParams: async () => ({ minFee: 1000n }),
    getMinFeeConfig: () => ({ minTxnFee: 1000n, pqMultiplier: 3n }),
})

const makeDeps = () => {
    const createPaymentTransaction = vi.fn().mockResolvedValue({ kind: 'pay' })
    const createAssetTransferTransaction = vi
        .fn()
        .mockResolvedValue({ kind: 'axfer' })
    const encodeTransaction = vi.fn().mockReturnValue(mockEncoded)
    return {
        deps: {
            createPaymentTransaction,
            createAssetTransferTransaction,
            encodeTransaction,
            resolveMinFeeForSender,
        },
        createPaymentTransaction,
        createAssetTransferTransaction,
        encodeTransaction,
    }
}

describe('createPaymentSource', () => {
    test('builds ALGO payment when assetId is absent', async () => {
        const {
            deps,
            createPaymentTransaction,
            createAssetTransferTransaction,
        } = makeDeps()
        const source = createPaymentSource(deps)

        const group = await source.getSignableData({
            sender: 'SENDER',
            receiver: 'RECEIVER',
            amount: 1000n,
        })

        expect(createPaymentTransaction).toHaveBeenCalledWith({
            sender: 'SENDER',
            receiver: 'RECEIVER',
            amount: 1000n,
            closeRemainderTo: undefined,
            note: undefined,
            fee: 1000n,
        })
        expect(createAssetTransferTransaction).not.toHaveBeenCalled()
        expect(group.signerAddress).toBe('SENDER')
        expect(group.data.type).toBe('transactions')
        if (group.data.type === 'transactions') {
            expect(group.data.indicesToSign).toEqual([0])
            expect(group.data.rawTransactionsBase64?.length).toBe(1)
        }
    })

    test('builds ALGO payment when assetId is 0n', async () => {
        const { deps, createPaymentTransaction } = makeDeps()
        const source = createPaymentSource(deps)

        await source.getSignableData({
            sender: 'SENDER',
            receiver: 'RECEIVER',
            amount: 1000n,
            assetId: 0n,
        })

        expect(createPaymentTransaction).toHaveBeenCalled()
    })

    test('close-account payment sets closeRemainderTo and amount=0', async () => {
        const { deps, createPaymentTransaction } = makeDeps()
        const source = createPaymentSource(deps)

        await source.getSignableData({
            sender: 'SENDER',
            receiver: 'RECEIVER',
            amount: 1_000_000n,
            isCloseAccount: true,
            note: 'bye',
        })

        expect(createPaymentTransaction).toHaveBeenCalledWith({
            sender: 'SENDER',
            receiver: 'RECEIVER',
            amount: 0n,
            closeRemainderTo: 'RECEIVER',
            note: 'bye',
            fee: 1000n,
        })
    })

    test('builds asset transfer when assetId provided', async () => {
        const {
            deps,
            createAssetTransferTransaction,
            createPaymentTransaction,
        } = makeDeps()
        const source = createPaymentSource(deps)

        await source.getSignableData({
            sender: 'SENDER',
            receiver: 'RECEIVER',
            amount: 5n,
            assetId: 123n,
            note: 'hi',
        })

        expect(createAssetTransferTransaction).toHaveBeenCalledWith({
            sender: 'SENDER',
            receiver: 'RECEIVER',
            amount: 5n,
            assetId: 123n,
            note: 'hi',
            fee: 1000n,
        })
        expect(createPaymentTransaction).not.toHaveBeenCalled()
    })

    test('wraps builder errors in SourceError', async () => {
        const deps = {
            createPaymentTransaction: vi
                .fn()
                .mockRejectedValue(new Error('boom')),
            createAssetTransferTransaction: vi.fn(),
            encodeTransaction: vi.fn(),
            resolveMinFeeForSender,
        }
        const source = createPaymentSource(deps)

        await expect(
            source.getSignableData({
                sender: 'S',
                receiver: 'R',
                amount: 1n,
            }),
        ).rejects.toThrow('boom')
    })

    describe('PQ-aware min fee resolution', () => {
        test('ALGO payment from a quantum sender applies the PQ multiplier', async () => {
            const { deps, createPaymentTransaction } = makeDeps()
            const source = createPaymentSource(deps)

            await source.getSignableData({
                sender: 'QSENDER',
                receiver: 'RECEIVER',
                amount: 1000n,
            })

            expect(createPaymentTransaction).toHaveBeenCalledWith({
                sender: 'QSENDER',
                receiver: 'RECEIVER',
                amount: 1000n,
                closeRemainderTo: undefined,
                note: undefined,
                fee: 3000n,
            })
        })

        test('ALGO payment from an algo25 sender uses the base fee (regression)', async () => {
            const { deps, createPaymentTransaction } = makeDeps()
            const source = createPaymentSource(deps)

            await source.getSignableData({
                sender: 'ASENDER',
                receiver: 'RECEIVER',
                amount: 1000n,
            })

            expect(createPaymentTransaction).toHaveBeenCalledWith({
                sender: 'ASENDER',
                receiver: 'RECEIVER',
                amount: 1000n,
                closeRemainderTo: undefined,
                note: undefined,
                fee: 1000n,
            })
        })

        test('ASA transfer from a quantum sender applies the PQ multiplier', async () => {
            const { deps, createAssetTransferTransaction } = makeDeps()
            const source = createPaymentSource(deps)

            await source.getSignableData({
                sender: 'QSENDER',
                receiver: 'RECEIVER',
                amount: 5n,
                assetId: 123n,
            })

            expect(createAssetTransferTransaction).toHaveBeenCalledWith({
                sender: 'QSENDER',
                receiver: 'RECEIVER',
                amount: 5n,
                assetId: 123n,
                note: undefined,
                fee: 3000n,
            })
        })

        test('close-account payment from a quantum sender applies the PQ multiplier and keeps close semantics', async () => {
            const { deps, createPaymentTransaction } = makeDeps()
            const source = createPaymentSource(deps)

            await source.getSignableData({
                sender: 'QSENDER',
                receiver: 'RECEIVER',
                amount: 1_000_000n,
                isCloseAccount: true,
            })

            expect(createPaymentTransaction).toHaveBeenCalledWith({
                sender: 'QSENDER',
                receiver: 'RECEIVER',
                amount: 0n,
                closeRemainderTo: 'RECEIVER',
                note: undefined,
                fee: 3000n,
            })
        })

        test('sender rekeyed to a quantum auth account applies the PQ multiplier', async () => {
            const { deps, createPaymentTransaction } = makeDeps()
            const source = createPaymentSource(deps)

            await source.getSignableData({
                sender: 'REKEYED',
                receiver: 'RECEIVER',
                amount: 1000n,
            })

            expect(createPaymentTransaction).toHaveBeenCalledWith({
                sender: 'REKEYED',
                receiver: 'RECEIVER',
                amount: 1000n,
                closeRemainderTo: undefined,
                note: undefined,
                fee: 3000n,
            })
        })

        test('quantum sender rekeyed to an algo25 auth account uses the base fee', async () => {
            const { deps, createPaymentTransaction } = makeDeps()
            const source = createPaymentSource(deps)

            await source.getSignableData({
                sender: 'QREKEYED',
                receiver: 'RECEIVER',
                amount: 1000n,
            })

            expect(createPaymentTransaction).toHaveBeenCalledWith({
                sender: 'QREKEYED',
                receiver: 'RECEIVER',
                amount: 1000n,
                closeRemainderTo: undefined,
                note: undefined,
                fee: 1000n,
            })
        })
    })
})

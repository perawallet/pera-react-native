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
import { createExpressSendSource } from '../createExpressSendSource'
import { createMinFeeResolver } from '../minFeeResolver'

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
] as WalletAccount[]

const makeDeps = (overrides?: {
    currentBalance?: bigint
    currentMbr?: bigint
    minFee?: bigint
    assetMbr?: bigint
    accounts?: WalletAccount[]
}) => {
    const {
        currentBalance = 0n,
        currentMbr = 100_000n,
        minFee = 1_000n,
        assetMbr = 100_000n,
        accounts = FIXTURE_ACCOUNTS,
    } = overrides ?? {}

    const createPaymentTransaction = vi
        .fn()
        .mockImplementation(async ({ amount, fee }) => ({
            kind: 'pay',
            amount,
            fee,
        }))
    const createAssetOptInTransaction = vi
        .fn()
        .mockImplementation(async ({ fee }) => ({ kind: 'optin', fee }))
    const createAssetTransferTransaction = vi
        .fn()
        .mockImplementation(async ({ fee }) => ({ kind: 'axfer', fee }))
    const encodeTransaction = vi.fn().mockReturnValue(new Uint8Array([1]))
    const getAccountInfo = vi.fn().mockResolvedValue({
        amount: currentBalance,
        minBalance: currentMbr,
    })
    const getSuggestedParams = vi.fn().mockResolvedValue({ minFee })
    const resolveMinFeeForSender = createMinFeeResolver({
        getAccounts: () => accounts,
        getSuggestedParams,
        getMinFeeConfig: () => ({ minTxnFee: minFee, pqMultiplier: 3n }),
    })

    return {
        deps: {
            createPaymentTransaction,
            createAssetTransferTransaction,
            createAssetOptInTransaction,
            encodeTransaction,
            getAccountInfo,
            resolveMinFeeForSender,
            assetMbr,
        },
        createPaymentTransaction,
        createAssetOptInTransaction,
        createAssetTransferTransaction,
    }
}

describe('createExpressSendSource', () => {
    test('includes funding tx when receiver lacks MBR + fee', async () => {
        // receiver has 0 balance, needs currentMbr(100k) + assetMbr(100k) + minFee(1k)
        const { deps, createPaymentTransaction } = makeDeps({
            currentBalance: 0n,
            currentMbr: 100_000n,
            assetMbr: 100_000n,
            minFee: 1_000n,
        })
        const source = createExpressSendSource(deps)

        const group = await source.getSignableData({
            sender: 'SENDER',
            receiver: 'RECEIVER',
            amount: 5n,
            assetId: 42n,
        })

        expect(createPaymentTransaction).toHaveBeenCalledWith({
            sender: 'SENDER',
            receiver: 'RECEIVER',
            amount: 201_000n,
            fee: 1_000n,
        })
        expect(group.data.type).toBe('transactions')
        if (group.data.type === 'transactions') {
            // [funding, opt-in, transfer] = 3 txs, sender signs index 0 and 2
            expect(group.data.transactions).toHaveLength(3)
            expect(group.data.indicesToSign).toEqual([0, 2])
        }
    })

    test('omits funding tx when receiver already funded', async () => {
        const { deps, createPaymentTransaction } = makeDeps({
            currentBalance: 10_000_000n,
            currentMbr: 100_000n,
            assetMbr: 100_000n,
            minFee: 1_000n,
        })
        const source = createExpressSendSource(deps)

        const group = await source.getSignableData({
            sender: 'SENDER',
            receiver: 'RECEIVER',
            amount: 5n,
            assetId: 42n,
        })

        expect(createPaymentTransaction).not.toHaveBeenCalled()
        if (group.data.type === 'transactions') {
            // [opt-in, transfer] = 2 txs, sender only signs transfer (index 1)
            expect(group.data.transactions).toHaveLength(2)
            expect(group.data.indicesToSign).toEqual([1])
        }
    })

    test('opt-in is signed by receiver (not in sender indicesToSign)', async () => {
        const { deps, createAssetOptInTransaction } = makeDeps({
            currentBalance: 10_000_000n,
        })
        const source = createExpressSendSource(deps)

        await source.getSignableData({
            sender: 'SENDER',
            receiver: 'RECEIVER',
            amount: 5n,
            assetId: 42n,
        })

        expect(createAssetOptInTransaction).toHaveBeenCalledWith({
            sender: 'RECEIVER',
            assetId: 42n,
            fee: 1_000n,
        })
    })

    test('wraps builder errors in SourceError', async () => {
        const { deps } = makeDeps()
        deps.getAccountInfo = vi
            .fn()
            .mockRejectedValue(new Error('lookup fail'))
        const source = createExpressSendSource(deps)

        await expect(
            source.getSignableData({
                sender: 'S',
                receiver: 'R',
                amount: 1n,
                assetId: 1n,
            }),
        ).rejects.toThrow('lookup fail')
    })

    describe('PQ-aware per-txn fees and receiver funding', () => {
        test('algo25 sender, external receiver, 0 balance: funding stays base rate (regression)', async () => {
            const {
                deps,
                createPaymentTransaction,
                createAssetOptInTransaction,
                createAssetTransferTransaction,
            } = makeDeps({
                currentBalance: 0n,
                currentMbr: 100_000n,
                assetMbr: 100_000n,
                minFee: 1_000n,
            })
            const source = createExpressSendSource(deps)

            const group = await source.getSignableData({
                sender: 'ASENDER',
                receiver: 'EXTERNAL_RECEIVER',
                amount: 5n,
                assetId: 42n,
            })

            expect(createPaymentTransaction).toHaveBeenCalledWith({
                sender: 'ASENDER',
                receiver: 'EXTERNAL_RECEIVER',
                amount: 201_000n,
                fee: 1_000n,
            })
            expect(createAssetOptInTransaction).toHaveBeenCalledWith({
                sender: 'EXTERNAL_RECEIVER',
                assetId: 42n,
                fee: 1_000n,
            })
            expect(createAssetTransferTransaction).toHaveBeenCalledWith({
                sender: 'ASENDER',
                receiver: 'EXTERNAL_RECEIVER',
                amount: 5n,
                assetId: 42n,
                fee: 1_000n,
            })
            if (group.data.type === 'transactions') {
                expect(group.data.transactions).toHaveLength(3)
                expect(group.data.indicesToSign).toEqual([0, 2])
            }
        })

        test('quantum sender, external receiver, 0 balance: sender-side fees are PQ, funding amount stays at receiver base rate', async () => {
            const {
                deps,
                createPaymentTransaction,
                createAssetOptInTransaction,
                createAssetTransferTransaction,
            } = makeDeps({
                currentBalance: 0n,
                currentMbr: 100_000n,
                assetMbr: 100_000n,
                minFee: 1_000n,
            })
            const source = createExpressSendSource(deps)

            await source.getSignableData({
                sender: 'QSENDER',
                receiver: 'EXTERNAL_RECEIVER',
                amount: 5n,
                assetId: 42n,
            })

            expect(createPaymentTransaction).toHaveBeenCalledWith({
                sender: 'QSENDER',
                receiver: 'EXTERNAL_RECEIVER',
                amount: 201_000n,
                fee: 3_000n,
            })
            expect(createAssetOptInTransaction).toHaveBeenCalledWith({
                sender: 'EXTERNAL_RECEIVER',
                assetId: 42n,
                fee: 1_000n,
            })
            expect(createAssetTransferTransaction).toHaveBeenCalledWith({
                sender: 'QSENDER',
                receiver: 'EXTERNAL_RECEIVER',
                amount: 5n,
                assetId: 42n,
                fee: 3_000n,
            })

            const totalFees =
                createPaymentTransaction.mock.calls[0][0].fee +
                createAssetOptInTransaction.mock.calls[0][0].fee +
                createAssetTransferTransaction.mock.calls[0][0].fee
            expect(totalFees).toBe(7_000n)
        })

        test('quantum receiver in the wallet, algo25 sender, 0 balance: funding reserves the receiver PQ opt-in fee', async () => {
            const receiverAddress = 'QRECEIVER'
            const {
                deps,
                createPaymentTransaction,
                createAssetOptInTransaction,
                createAssetTransferTransaction,
            } = makeDeps({
                currentBalance: 0n,
                currentMbr: 100_000n,
                assetMbr: 100_000n,
                minFee: 1_000n,
                accounts: [
                    ...FIXTURE_ACCOUNTS,
                    {
                        id: 'qr',
                        address: receiverAddress,
                        type: AccountTypes.quantum,
                        keyPairId: 'kp-qr',
                    } as WalletAccount,
                ],
            })
            const source = createExpressSendSource(deps)

            await source.getSignableData({
                sender: 'ASENDER',
                receiver: receiverAddress,
                amount: 5n,
                assetId: 42n,
            })

            expect(createPaymentTransaction).toHaveBeenCalledWith({
                sender: 'ASENDER',
                receiver: receiverAddress,
                amount: 203_000n,
                fee: 1_000n,
            })
            expect(createAssetOptInTransaction).toHaveBeenCalledWith({
                sender: receiverAddress,
                assetId: 42n,
                fee: 3_000n,
            })
            expect(createAssetTransferTransaction).toHaveBeenCalledWith({
                sender: 'ASENDER',
                receiver: receiverAddress,
                amount: 5n,
                assetId: 42n,
                fee: 1_000n,
            })
        })

        test('funded receiver: 2-txn group unchanged, opt-in/transfer fees follow resolved rates', async () => {
            const {
                deps,
                createPaymentTransaction,
                createAssetOptInTransaction,
                createAssetTransferTransaction,
            } = makeDeps({
                currentBalance: 10_000_000n,
                currentMbr: 100_000n,
                assetMbr: 100_000n,
                minFee: 1_000n,
            })
            const source = createExpressSendSource(deps)

            const group = await source.getSignableData({
                sender: 'QSENDER',
                receiver: 'EXTERNAL_RECEIVER',
                amount: 5n,
                assetId: 42n,
            })

            expect(createPaymentTransaction).not.toHaveBeenCalled()
            expect(createAssetOptInTransaction).toHaveBeenCalledWith({
                sender: 'EXTERNAL_RECEIVER',
                assetId: 42n,
                fee: 1_000n,
            })
            expect(createAssetTransferTransaction).toHaveBeenCalledWith({
                sender: 'QSENDER',
                receiver: 'EXTERNAL_RECEIVER',
                amount: 5n,
                assetId: 42n,
                fee: 3_000n,
            })
            if (group.data.type === 'transactions') {
                expect(group.data.transactions).toHaveLength(2)
                expect(group.data.indicesToSign).toEqual([1])
            }
        })
    })
})

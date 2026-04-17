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

import { describe, test, expect, vi } from 'vitest'
import { createExpressSendSource } from '../createExpressSendSource'

const makeDeps = (overrides?: {
    currentBalance?: bigint
    currentMbr?: bigint
    minFee?: bigint
    assetMbr?: bigint
}) => {
    const {
        currentBalance = 0n,
        currentMbr = 100_000n,
        minFee = 1_000n,
        assetMbr = 100_000n,
    } = overrides ?? {}

    const createPaymentTransaction = vi
        .fn()
        .mockImplementation(async ({ amount }) => ({ kind: 'pay', amount }))
    const createAssetOptInTransaction = vi
        .fn()
        .mockResolvedValue({ kind: 'optin' })
    const createAssetTransferTransaction = vi
        .fn()
        .mockResolvedValue({ kind: 'axfer' })
    const encodeTransaction = vi.fn().mockReturnValue(new Uint8Array([1]))
    const getAccountInfo = vi.fn().mockResolvedValue({
        amount: currentBalance,
        minBalance: currentMbr,
    })
    const getSuggestedParams = vi.fn().mockResolvedValue({ minFee })

    return {
        deps: {
            createPaymentTransaction,
            createAssetTransferTransaction,
            createAssetOptInTransaction,
            encodeTransaction,
            getAccountInfo,
            getSuggestedParams,
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
})

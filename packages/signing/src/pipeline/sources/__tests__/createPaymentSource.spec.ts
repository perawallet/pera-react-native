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
import { createPaymentSource } from '../createPaymentSource'

const mockEncoded = new Uint8Array([1, 2, 3])

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
})

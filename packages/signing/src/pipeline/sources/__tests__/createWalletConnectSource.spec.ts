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
    createWalletConnectTransactionSource,
    createWalletConnectDataSource,
} from '../createWalletConnectSource'

describe('createWalletConnectTransactionSource', () => {
    test('wraps transaction request with walletconnect metadata and callbacks', async () => {
        const approve = vi.fn()
        const reject = vi.fn()
        const errorCb = vi.fn()
        const source = createWalletConnectTransactionSource()

        const group = await source.getSignableData({
            requestId: 42,
            clientId: 'client-1',
            transactions: [
                { sender: { toString: () => 'SENDER_ADDR' } } as never,
            ],
            rawTransactionsBase64: ['aGVsbG8='],
            indicesToSign: [0],
            peerMetadata: { name: 'dApp' },
            approve,
            reject,
            error: errorCb,
        })

        expect(group.signerAddress).toBe('SENDER_ADDR')
        expect(group.source.type).toBe('walletconnect')
        expect(group.source.requestId).toBe('42')
        expect(group.source.peerMetadata).toEqual({ name: 'dApp' })
        expect(group.source.callbacks?.approve).toBe(approve)
        expect(group.source.callbacks?.reject).toBe(reject)
        expect(group.source.callbacks?.error).toBe(errorCb)
        expect(group.data.type).toBe('transactions')
    })

    test('returns empty signer address when no transactions', async () => {
        const source = createWalletConnectTransactionSource()

        const group = await source.getSignableData({
            requestId: 1,
            clientId: 'client-1',
            transactions: [],
            rawTransactionsBase64: [],
            indicesToSign: [],
            approve: vi.fn(),
            reject: vi.fn(),
        })

        expect(group.signerAddress).toBe('')
    })
})

// PERA-4511: PQ-aware minimum fees were added to Pera-initiated sources
// (createPaymentSource, createExpressSendSource) via resolveMinFeeForSender.
// This legacy DataSource layer intentionally stays pass-through — PQ-017's
// quantum fee override lives one level up, in the runtime enqueue path
// (`useEnqueueArc0001SignRequest` → `applyQuantumFeeOverride`), where the
// signer set and suggested params are available. This pins that the
// DataSource still forwards dApp-set fees untouched.
describe('createWalletConnectTransactionSource - fee pass-through regression', () => {
    test('passes dApp-set fees through unchanged (PQ fee resolution does not apply to external sources)', async () => {
        const source = createWalletConnectTransactionSource()

        const transactions = [
            { sender: { toString: () => 'SENDER_ADDR' }, fee: 1000n } as never,
            { sender: { toString: () => 'SENDER_ADDR' }, fee: 0n } as never,
            { sender: { toString: () => 'SENDER_ADDR' }, fee: 5000n } as never,
        ]

        const group = await source.getSignableData({
            requestId: 99,
            clientId: 'client-1',
            transactions,
            rawTransactionsBase64: ['aGVsbG8=', 'd29ybGQ=', 'ZmVl'],
            indicesToSign: [0, 1, 2],
            approve: vi.fn(),
            reject: vi.fn(),
        })

        expect(group.data.type).toBe('transactions')
        if (group.data.type === 'transactions') {
            expect(group.data.transactions.map(tx => tx.fee)).toEqual([
                1000n,
                0n,
                5000n,
            ])
        }
    })

    test('has no resolveMinFeeForSender dependency (takes no dependencies at all)', () => {
        expect(createWalletConnectTransactionSource).toHaveLength(0)
    })
})

describe('createWalletConnectDataSource', () => {
    test('wraps data request with arbitrary-data signable and signer metadata', async () => {
        const approve = vi.fn()
        const reject = vi.fn()
        const source = createWalletConnectDataSource()

        const group = await source.getSignableData({
            requestId: 7,
            clientId: 'c',
            data: [
                {
                    signer: 'SIGNER_A',
                    data: 'payload-A',
                    message: 'hello',
                    chainId: 283,
                },
                {
                    signer: 'SIGNER_B',
                    data: 'payload-B',
                    chainId: 283,
                },
            ],
            peerMetadata: { url: 'https://a.b' },
            approve,
            reject,
        })

        expect(group.signerAddress).toBe('SIGNER_A')
        expect(group.source.type).toBe('walletconnect')
        expect(group.source.requestId).toBe('7')
        expect(group.data.type).toBe('arbitrary-data')
        if (group.data.type === 'arbitrary-data') {
            expect(group.data.data).toHaveLength(2)
            expect(group.data.data[0].signer).toBe('SIGNER_A')
        }
    })

    test('returns empty signer address when no data items', async () => {
        const source = createWalletConnectDataSource()

        const group = await source.getSignableData({
            requestId: 1,
            clientId: 'c',
            data: [],
            approve: vi.fn(),
            reject: vi.fn(),
        })

        expect(group.signerAddress).toBe('')
    })
})

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
import { aggregateTransactionWarnings } from '../warnings'
import type { PeraDisplayableTransaction } from '@perawallet/wallet-core-blockchain'

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    encodeAlgorandAddress: vi.fn(
        (bytes: Uint8Array) => `ENCODED_${new TextDecoder().decode(bytes)}`,
    ),
}))

const makeTx = (
    overrides: Partial<PeraDisplayableTransaction> = {},
): PeraDisplayableTransaction =>
    ({
        sender: 'ADDR1',
        ...overrides,
    }) as unknown as PeraDisplayableTransaction

describe('aggregateTransactionWarnings', () => {
    const signableAddresses = new Set(['ADDR1', 'ADDR2'])

    test('returns empty array when no warnings', () => {
        const txs = [makeTx()]
        expect(aggregateTransactionWarnings(txs, signableAddresses)).toEqual([])
    })

    test('returns empty array for empty transactions', () => {
        expect(aggregateTransactionWarnings([], signableAddresses)).toEqual([])
    })

    test('detects close-to warning from payment transaction', () => {
        const txs = [
            makeTx({
                paymentTransaction: {
                    closeRemainderTo: 'CLOSE_ADDR',
                } as any,
            }),
        ]

        const warnings = aggregateTransactionWarnings(txs, signableAddresses)
        expect(warnings).toEqual([
            {
                type: 'close',
                senderAddress: 'ADDR1',
                targetAddress: 'CLOSE_ADDR',
            },
        ])
    })

    test('detects close-to warning from asset transfer transaction', () => {
        const txs = [
            makeTx({
                assetTransferTransaction: {
                    closeTo: 'ASSET_CLOSE_ADDR',
                } as any,
            }),
        ]

        const warnings = aggregateTransactionWarnings(txs, signableAddresses)
        expect(warnings).toEqual([
            {
                type: 'close',
                senderAddress: 'ADDR1',
                targetAddress: 'ASSET_CLOSE_ADDR',
            },
        ])
    })

    test('detects rekey warning', () => {
        const txs = [
            makeTx({
                rekeyTo: {
                    publicKey: new TextEncoder().encode('REKEY_TARGET'),
                } as any,
            }),
        ]

        const warnings = aggregateTransactionWarnings(txs, signableAddresses)
        expect(warnings).toEqual([
            {
                type: 'rekey',
                senderAddress: 'ADDR1',
                targetAddress: 'ENCODED_REKEY_TARGET',
            },
        ])
    })

    test('skips transactions from non-signable addresses', () => {
        const txs = [
            makeTx({
                sender: 'UNKNOWN_ADDR',
                paymentTransaction: {
                    closeRemainderTo: 'CLOSE_ADDR',
                } as any,
            }),
        ]

        const warnings = aggregateTransactionWarnings(txs, signableAddresses)
        expect(warnings).toEqual([])
    })

    test('skips transactions with no sender', () => {
        const txs = [
            makeTx({
                sender: undefined as any,
                paymentTransaction: {
                    closeRemainderTo: 'CLOSE_ADDR',
                } as any,
            }),
        ]

        const warnings = aggregateTransactionWarnings(txs, signableAddresses)
        expect(warnings).toEqual([])
    })

    test('detects multiple warnings from multiple transactions', () => {
        const txs = [
            makeTx({
                paymentTransaction: {
                    closeRemainderTo: 'CLOSE_ADDR',
                } as any,
            }),
            makeTx({
                sender: 'ADDR2',
                rekeyTo: {
                    publicKey: new TextEncoder().encode('REKEY_TARGET'),
                } as any,
            }),
        ]

        const warnings = aggregateTransactionWarnings(txs, signableAddresses)
        expect(warnings).toHaveLength(2)
        expect(warnings[0].type).toBe('close')
        expect(warnings[1].type).toBe('rekey')
    })

    test('detects both close and rekey on same transaction', () => {
        const txs = [
            makeTx({
                paymentTransaction: {
                    closeRemainderTo: 'CLOSE_ADDR',
                } as any,
                rekeyTo: {
                    publicKey: new TextEncoder().encode('REKEY_TARGET'),
                } as any,
            }),
        ]

        const warnings = aggregateTransactionWarnings(txs, signableAddresses)
        expect(warnings).toHaveLength(2)
        expect(warnings[0].type).toBe('close')
        expect(warnings[1].type).toBe('rekey')
    })
})

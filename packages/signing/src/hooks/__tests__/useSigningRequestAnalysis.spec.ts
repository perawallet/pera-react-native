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
import { renderHook } from '@testing-library/react'
import { useSigningRequestAnalysis } from '../useSigningRequestAnalysis'
import type { TransactionSignRequest } from '../../models'
import Decimal from 'decimal.js'

const mockMapToDisplayableTransaction = vi.fn()

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    mapToDisplayableTransaction: (...args: unknown[]) =>
        mockMapToDisplayableTransaction(...args),
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useAllAccounts: vi.fn(() => [
        { address: 'ADDR1', canSign: true },
        { address: 'ADDR2', canSign: false },
    ]),
}))

const makeMockTx = (sender: string, group?: Uint8Array) => ({
    sender: { toString: () => sender, publicKey: new Uint8Array() },
    group,
})

const makeDisplayableTx = (overrides: Record<string, unknown> = {}) => ({
    sender: 'ADDR1',
    fee: 1000n,
    group: undefined,
    ...overrides,
})

describe('useSigningRequestAnalysis', () => {
    test('maps transactions to displayable and computes derived state', () => {
        const groupId = new Uint8Array([1, 2, 3])
        const mockTx1 = makeMockTx('ADDR1', groupId)
        const mockTx2 = makeMockTx('ADDR1', groupId)

        mockMapToDisplayableTransaction
            .mockReturnValueOnce(makeDisplayableTx({ fee: 1000n, group: groupId }))
            .mockReturnValueOnce(makeDisplayableTx({ fee: 2000n, group: groupId }))

        const request: TransactionSignRequest = {
            id: 'req-1',
            type: 'transactions',
            transport: 'algod',
            txs: [mockTx1, mockTx2] as any,
        }

        const { result } = renderHook(() => useSigningRequestAnalysis(request))

        expect(result.current.groups).toHaveLength(1)
        expect(result.current.groups[0]).toHaveLength(2)
        expect(result.current.allTransactions).toHaveLength(2)
        // 3000 microAlgo = 0.003 ALGO
        expect(result.current.totalFee.eq(new Decimal(0.003))).toBe(true)
        expect(result.current.requestStructure).toBe('group')
    })

    test('filters out null displayable transactions', () => {
        mockMapToDisplayableTransaction
            .mockReturnValueOnce(makeDisplayableTx())
            .mockReturnValueOnce(null)

        const request: TransactionSignRequest = {
            id: 'req-1',
            type: 'transactions',
            transport: 'algod',
            txs: [makeMockTx('ADDR1'), makeMockTx('ADDR1')] as any,
        }

        const { result } = renderHook(() => useSigningRequestAnalysis(request))

        expect(result.current.allTransactions).toHaveLength(1)
    })

    test('classifies single transaction correctly', () => {
        mockMapToDisplayableTransaction.mockReturnValueOnce(makeDisplayableTx())

        const request: TransactionSignRequest = {
            id: 'req-1',
            type: 'transactions',
            transport: 'algod',
            txs: [makeMockTx('ADDR1')] as any,
        }

        const { result } = renderHook(() => useSigningRequestAnalysis(request))

        expect(result.current.requestStructure).toBe('single')
    })

    test('classifies multiple groups correctly', () => {
        const group1 = new Uint8Array([1, 2, 3])
        const group2 = new Uint8Array([4, 5, 6])

        mockMapToDisplayableTransaction
            .mockReturnValueOnce(makeDisplayableTx({ group: group1 }))
            .mockReturnValueOnce(makeDisplayableTx({ group: group2 }))

        const request: TransactionSignRequest = {
            id: 'req-1',
            type: 'transactions',
            transport: 'algod',
            txs: [makeMockTx('ADDR1', group1), makeMockTx('ADDR1', group2)] as any,
        }

        const { result } = renderHook(() => useSigningRequestAnalysis(request))

        expect(result.current.requestStructure).toBe('group-list')
    })

    test('aggregates warnings for signable addresses', () => {
        mockMapToDisplayableTransaction.mockReturnValueOnce(
            makeDisplayableTx({
                sender: 'ADDR1',
                paymentTransaction: { closeRemainderTo: 'CLOSE_ADDR' },
            }),
        )

        const request: TransactionSignRequest = {
            id: 'req-1',
            type: 'transactions',
            transport: 'algod',
            txs: [makeMockTx('ADDR1')] as any,
        }

        const { result } = renderHook(() => useSigningRequestAnalysis(request))

        expect(result.current.warnings).toHaveLength(1)
        expect(result.current.warnings[0]).toEqual({
            type: 'close',
            senderAddress: 'ADDR1',
            targetAddress: 'CLOSE_ADDR',
        })
    })

    test('does not warn for non-signable addresses', () => {
        mockMapToDisplayableTransaction.mockReturnValueOnce(
            makeDisplayableTx({
                sender: 'ADDR2',
                paymentTransaction: { closeRemainderTo: 'CLOSE_ADDR' },
            }),
        )

        const request: TransactionSignRequest = {
            id: 'req-1',
            type: 'transactions',
            transport: 'algod',
            txs: [makeMockTx('ADDR2')] as any,
        }

        const { result } = renderHook(() => useSigningRequestAnalysis(request))

        expect(result.current.warnings).toHaveLength(0)
    })
})

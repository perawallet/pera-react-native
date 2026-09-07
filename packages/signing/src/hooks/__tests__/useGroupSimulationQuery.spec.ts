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

import { describe, test, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Address, Transaction, TransactionType } from 'algosdk'
import {
    groupTransactions,
    type PeraDisplayableTransaction,
    type PeraTransaction,
} from '@perawallet/wallet-core-blockchain'
import { useGroupSimulationQuery } from '../useGroupSimulationQuery'

const mockSimulate = vi.fn()
// Faithful to the real composer: it rejects any transaction that already
// carries a group id (composer.addTransaction → "already in a group").
const mockAddTransaction = vi.fn((txn?: { group?: unknown }) => {
    if (txn?.group) {
        throw new Error(
            'Cannot add a transaction to the composer because it is already in a group',
        )
    }
})
const mockNewGroup = vi.fn(() => ({
    addTransaction: mockAddTransaction,
    simulate: mockSimulate,
}))

const SENDER = Address.zeroAddress()
const RECEIVER = new Address(new Uint8Array(32).fill(7))

const payment = (amount: bigint): Transaction =>
    new Transaction({
        type: TransactionType.pay,
        sender: SENDER,
        suggestedParams: {
            fee: 1000n,
            minFee: 1000n,
            firstValid: 1000n,
            lastValid: 2000n,
            genesisHash: new Uint8Array(32),
            genesisID: 'testnet-v1.0',
        },
        paymentParams: { receiver: RECEIVER, amount },
    })

vi.mock('@perawallet/wallet-core-blockchain', async () => {
    const actual = await vi.importActual<object>(
        '@perawallet/wallet-core-blockchain',
    )
    return {
        ...actual,
        useAlgorandClient: () => ({ newGroup: mockNewGroup }),
        useNetwork: () => ({ network: 'mainnet' }),
        // Passthrough so flattenSimulatedInnerTransactions keeps every inner txn.
        mapToDisplayableTransaction: (txn: unknown) => txn,
    }
})

const wrapper = ({ children }: { children: React.ReactNode }) => {
    const client = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    })
    return React.createElement(QueryClientProvider, { client }, children)
}

// A simulate response carrying two inner txns under one group result.
const responseWithInnerTxns = {
    simulateResponse: {
        txnGroups: [
            {
                txnResults: [
                    {
                        txnResult: {
                            innerTxns: [
                                { txn: { txn: { id: 'inner-1' } } },
                                { txn: { txn: { id: 'inner-2' } } },
                            ],
                        },
                    },
                ],
            },
        ],
    },
}

const groupTxs = [{ id: 'top-1' }] as unknown as PeraTransaction[]

describe('useGroupSimulationQuery', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockSimulate.mockResolvedValue(responseWithInnerTxns)
    })

    test('stays disabled (no simulation) when enabled is false', async () => {
        const { result } = renderHook(
            () =>
                useGroupSimulationQuery({
                    requestId: 'req-1',
                    groupTxs,
                    enabled: false,
                }),
            { wrapper },
        )

        await waitFor(() => expect(result.current.isFetching).toBe(false))
        expect(mockSimulate).not.toHaveBeenCalled()
        expect(result.current.data).toBeUndefined()
    })

    test('stays disabled when there are no group transactions', async () => {
        const { result } = renderHook(
            () =>
                useGroupSimulationQuery({
                    requestId: 'req-1',
                    groupTxs: [],
                    enabled: true,
                }),
            { wrapper },
        )

        await waitFor(() => expect(result.current.isFetching).toBe(false))
        expect(mockSimulate).not.toHaveBeenCalled()
    })

    test('simulates and returns the flattened inner transactions', async () => {
        const { result } = renderHook(
            () =>
                useGroupSimulationQuery({
                    requestId: 'req-1',
                    groupTxs,
                    enabled: true,
                }),
            { wrapper },
        )

        await waitFor(() => expect(result.current.isSuccess).toBe(true))

        expect(mockAddTransaction).toHaveBeenCalledTimes(1)
        expect(mockSimulate).toHaveBeenCalledWith({
            skipSignatures: true,
            allowUnnamedResources: true,
        })
        const data = result.current.data as PeraDisplayableTransaction[]
        expect(data).toHaveLength(2)
    })

    test('simulates dApp groups by stripping the existing group id', async () => {
        // Real dApp interactions arrive already grouped — every txn carries a
        // group id. The composer rejects grouped txns, so the hook must clone
        // and clear the group before adding, or simulation never runs and the
        // receive side is lost.
        const grouped = groupTransactions([payment(1n), payment(2n)])
        expect(grouped[0].group).toBeDefined()

        const { result } = renderHook(
            () =>
                useGroupSimulationQuery({
                    requestId: 'req-1',
                    groupTxs: grouped as unknown as PeraTransaction[],
                    enabled: true,
                }),
            { wrapper },
        )

        await waitFor(() => expect(result.current.isSuccess).toBe(true))

        // Every transaction handed to the composer must be ungrouped.
        for (const call of mockAddTransaction.mock.calls) {
            expect(call[0]?.group).toBeUndefined()
        }
        const data = result.current.data as PeraDisplayableTransaction[]
        expect(data).toHaveLength(2)
    })

    test('surfaces simulation failure as an error result', async () => {
        mockSimulate.mockRejectedValue(new Error('simulate failed'))

        const { result } = renderHook(
            () =>
                useGroupSimulationQuery({
                    requestId: 'req-1',
                    groupTxs,
                    enabled: true,
                }),
            { wrapper },
        )

        await waitFor(() => expect(result.current.isError).toBe(true))
    })
})

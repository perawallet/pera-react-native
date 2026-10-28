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

// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import { Transaction, generateAccount } from 'algosdk'

import { assignFeeToGroup as assignFeeToGroupMock } from '../assignMinimumFeesToGroup'
import { useAssignFeeToGroup } from '../useAssignFeeToGroup'
import {
    asUnsignedAlgorandTransaction,
    MAINNET_GENESIS_HASH,
    makeTestPaymentTx,
    payloadTransactionOf,
} from './transactions'
import type { PeraTransaction } from '../../blockchain/models/algosdk-shapes'

let liveStoreAccounts: WalletAccount[] = []
const mockFetchSuggestedMinFee = vi.fn()
const mockUseMinimumFeeConfig = vi.fn()

vi.mock('@perawallet/wallet-core-accounts', async () => {
    const actual = await vi.importActual<object>(
        '@perawallet/wallet-core-accounts',
    )
    return {
        ...actual,
        useAccountsStore: {
            getState: () => ({ accounts: liveStoreAccounts }),
        },
    }
})

vi.mock('../../blockchain', async () => {
    const actual =
        await vi.importActual<Record<string, unknown>>('../../blockchain')
    return {
        ...actual,
        useFetchSuggestedMinFee: () => mockFetchSuggestedMinFee,
        useMinimumFeeConfig: () => mockUseMinimumFeeConfig(),
    }
})

vi.mock('../assignMinimumFeesToGroup', () => ({
    assignFeeToGroup: vi.fn(),
}))

const payment = (): PeraTransaction =>
    makeTestPaymentTx(generateAccount().addr, {
        receiver: generateAccount().addr,
        genesisHash: MAINNET_GENESIS_HASH,
    })
const transactions = [
    asUnsignedAlgorandTransaction(payment()),
    asUnsignedAlgorandTransaction(payment()),
]
const unchanged = (params: { transactions: PeraTransaction[] }) =>
    Promise.resolve({ transactions: params.transactions, adjustments: [] })

type PlannerDeps = {
    accounts: WalletAccount[]
    configMinTxnFee: bigint
    pqMultiplier: bigint
    fetchSuggestedMinFee: () => Promise<bigint>
}

describe('useAssignFeeToGroup', () => {
    const assignFeeToGroup = vi.mocked(assignFeeToGroupMock)

    beforeEach(() => {
        vi.clearAllMocks()
        liveStoreAccounts = []
        mockFetchSuggestedMinFee.mockResolvedValue(2000n)
        mockUseMinimumFeeConfig.mockReturnValue({
            minTxnFee: 1000n,
            pqMultiplier: 3n,
        })
        assignFeeToGroup.mockImplementation(unchanged)
    })

    it('hands the assigner the params, the fee config and a fee fetcher that never throws', async () => {
        const { result } = renderHook(() => useAssignFeeToGroup())
        const params = { transactions, signableIndices: [0] }

        const outcome = await result.current(params)

        expect(outcome).toEqual({ transactions, adjustments: [] })
        expect(outcome.transactions).toBe(transactions)
        const [calledParams, deps] = assignFeeToGroup.mock
            .calls[0] as unknown as [
            { transactions: PeraTransaction[]; signableIndices: number[] },
            PlannerDeps,
        ]
        expect(calledParams).toEqual({
            transactions: transactions.map(payloadTransactionOf),
            signableIndices: [0],
        })
        expect(deps.configMinTxnFee).toBe(1000n)
        expect(deps.pqMultiplier).toBe(3n)
        await expect(deps.fetchSuggestedMinFee()).resolves.toBe(2000n)
        expect(mockFetchSuggestedMinFee).toHaveBeenCalledWith({ fallback: 0n })
    })

    it('resolves accounts from live store state, not the value captured at render', async () => {
        liveStoreAccounts = [{ id: 'a1' } as WalletAccount]
        const { result } = renderHook(() => useAssignFeeToGroup())
        const captured = result.current

        // A rekey lands in the live store without a re-render, as with a
        // WalletConnect listener whose owning component already unmounted.
        const rekeyed = [{ id: 'q1' } as WalletAccount]
        liveStoreAccounts = rekeyed
        await captured({ transactions })

        const [, deps] = assignFeeToGroup.mock.calls[0] as unknown as [
            unknown,
            PlannerDeps,
        ]
        expect(deps.accounts).toBe(rekeyed)
    })

    it('rewraps a raised transaction and keeps every unchanged one by reference', async () => {
        const raised = Transaction.fromEncodingData(
            payloadTransactionOf(transactions[0]).toEncodingData(),
        )
        raised.fee = 3000n
        const adjustments = [
            {
                index: 0,
                originalFee: 1000n,
                adjustedFee: 3000n,
                reason: 'quantum-minimum' as const,
            },
        ]
        assignFeeToGroup.mockImplementation(async params => ({
            transactions: [raised, params.transactions[1]],
            adjustments,
        }))
        const { result } = renderHook(() => useAssignFeeToGroup())

        const outcome = await result.current({ transactions })

        expect(outcome.adjustments).toBe(adjustments)
        expect(payloadTransactionOf(outcome.transactions[0])).toBe(raised)
        expect(outcome.transactions[0].scope).toEqual(transactions[0].scope)
        expect(outcome.transactions[1]).toBe(transactions[1])
    })
})

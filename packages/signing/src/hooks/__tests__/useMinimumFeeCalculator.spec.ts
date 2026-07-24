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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import {
    AccountTypes,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import type { PeraTransaction } from '@perawallet/wallet-core-blockchain'

import {
    makeTestAddress,
    makeTestPaymentTx,
} from '../../test-utils/transactions'
import { useMinimumFeeCalculator } from '../useMinimumFeeCalculator'

const mockUseAllAccounts = vi.fn<() => WalletAccount[]>(() => [])
const mockGetSuggestedParams = vi.fn(async () => ({ minFee: 1000n }))
const mockUseMinimumFeeConfig = vi.fn(() => ({
    minTxnFee: 1000n,
    pqMultiplier: 3n,
}))

// Keep the real `getSignerFor` / `isQuantumAccount` — the calculator's
// precheck and the fee core both depend on them; only the list is injected.
vi.mock('@perawallet/wallet-core-accounts', async () => {
    const actual = await vi.importActual<object>(
        '@perawallet/wallet-core-accounts',
    )
    return {
        ...actual,
        useAllAccounts: () => mockUseAllAccounts(),
    }
})

// Spread the real module so `assignMinimumFeesToGroup`'s dependencies
// (`calculateMinTxnFee`, `groupTransactions`) stay real; inject only the
// hooks the calculator consumes. The suggested-params fetcher is stubbed at
// the hook boundary — its fetch-through-cache semantics are covered by
// packages/blockchain/src/hooks/__tests__/useSuggestedParametersQuery.test.ts.
vi.mock('@perawallet/wallet-core-blockchain', async () => {
    const actual = await vi.importActual<Record<string, unknown>>(
        '@perawallet/wallet-core-blockchain',
    )
    return {
        ...actual,
        useFetchSuggestedParameters: () => mockGetSuggestedParams,
        useMinimumFeeConfig: () => mockUseMinimumFeeConfig(),
    }
})

const quantumAddress = makeTestAddress(1)
const algoAddress = makeTestAddress(2)
const receiverAddress = makeTestAddress(9)

const quantum = (): WalletAccount =>
    ({
        id: 'q1',
        address: quantumAddress.toString(),
        type: AccountTypes.quantum,
        keyPairId: 'kp-quantum',
    }) as WalletAccount

const algo25 = (): WalletAccount =>
    ({
        id: 'a1',
        address: algoAddress.toString(),
        type: AccountTypes.algo25,
        keyPairId: 'kp-algo25',
    }) as WalletAccount

const makePayment = (
    sender: ReturnType<typeof makeTestAddress>,
    fee: bigint,
): PeraTransaction => {
    const tx = makeTestPaymentTx(sender, {
        receiver: receiverAddress,
        amount: 1n,
    })
    tx.fee = fee
    return tx
}

describe('useMinimumFeeCalculator', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockUseAllAccounts.mockReturnValue([])
        mockGetSuggestedParams.mockResolvedValue({ minFee: 1000n })
        mockUseMinimumFeeConfig.mockReturnValue({
            minTxnFee: 1000n,
            pqMultiplier: 3n,
        })
    })

    it('returns the same array reference and fetches nothing for a non-quantum group', async () => {
        mockUseAllAccounts.mockReturnValue([algo25()])
        const transactions = [makePayment(algoAddress, 1000n)]
        const { result } = renderHook(() => useMinimumFeeCalculator())

        const outcome = await result.current.assignFeeToGroup({ transactions })

        expect(outcome.transactions).toBe(transactions)
        expect(outcome.adjustments).toEqual([])
        expect(mockGetSuggestedParams).not.toHaveBeenCalled()
    })

    it('raises a quantum signer fee to the PQ minimum with a reasoned adjustment record', async () => {
        mockUseAllAccounts.mockReturnValue([quantum()])
        const transactions = [makePayment(quantumAddress, 1000n)]
        const { result } = renderHook(() => useMinimumFeeCalculator())

        const outcome = await result.current.assignFeeToGroup({ transactions })

        expect(mockGetSuggestedParams).toHaveBeenCalledTimes(1)
        expect(outcome.transactions[0].fee).toBe(3000n)
        expect(outcome.adjustments).toEqual([
            {
                index: 0,
                originalFee: 1000n,
                adjustedFee: 3000n,
                reason: 'quantum-minimum',
            },
        ])
    })

    it('defaults signableIndices to every slot', async () => {
        mockUseAllAccounts.mockReturnValue([quantum()])
        const transactions = [
            makePayment(algoAddress, 1000n),
            makePayment(quantumAddress, 1000n),
        ]
        const { result } = renderHook(() => useMinimumFeeCalculator())

        const outcome = await result.current.assignFeeToGroup({ transactions })

        // The quantum slot at index 1 is only reachable when the default
        // covers the whole array.
        expect(outcome.adjustments).toEqual([
            {
                index: 1,
                originalFee: 1000n,
                adjustedFee: 3000n,
                reason: 'quantum-minimum',
            },
        ])
    })

    it('respects explicit signableIndices — a quantum slot outside them is untouched', async () => {
        mockUseAllAccounts.mockReturnValue([quantum()])
        const transactions = [
            makePayment(algoAddress, 1000n),
            makePayment(quantumAddress, 1000n),
        ]
        const { result } = renderHook(() => useMinimumFeeCalculator())

        const outcome = await result.current.assignFeeToGroup({
            transactions,
            signableIndices: [0],
        })

        expect(outcome.transactions).toBe(transactions)
        expect(outcome.adjustments).toEqual([])
        expect(mockGetSuggestedParams).not.toHaveBeenCalled()
    })

    it('falls back to the config base when the suggested-params fetch fails', async () => {
        mockUseAllAccounts.mockReturnValue([quantum()])
        mockGetSuggestedParams.mockRejectedValueOnce(new Error('offline'))
        const transactions = [makePayment(quantumAddress, 1000n)]
        const { result } = renderHook(() => useMinimumFeeCalculator())

        const outcome = await result.current.assignFeeToGroup({ transactions })

        // config base 1000 × pqMultiplier 3 = 3000; the failure never throws.
        expect(outcome.adjustments).toEqual([
            {
                index: 0,
                originalFee: 1000n,
                adjustedFee: 3000n,
                reason: 'quantum-minimum',
            },
        ])
    })

    it('applies the congestion guard from live suggested params', async () => {
        mockUseAllAccounts.mockReturnValue([quantum()])
        mockGetSuggestedParams.mockResolvedValueOnce({ minFee: 2000n })
        const transactions = [makePayment(quantumAddress, 1000n)]
        const { result } = renderHook(() => useMinimumFeeCalculator())

        const outcome = await result.current.assignFeeToGroup({ transactions })

        // max(suggested 2000, config 1000) × 3 = 6000
        expect(outcome.transactions[0].fee).toBe(6000n)
    })
})

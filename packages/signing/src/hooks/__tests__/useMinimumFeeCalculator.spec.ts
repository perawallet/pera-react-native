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
import '../../__tests__/registerAlgorandAccounts'
import { renderHook } from '@testing-library/react'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import type { PeraTransaction } from '@perawallet/wallet-core-blockchain'

import { registerFakePlannerAdapter } from '../../__tests__/fakePlannerAdapter'
import { useMinimumFeeCalculator } from '../useMinimumFeeCalculator'

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

vi.mock('@perawallet/wallet-core-blockchain', async () => {
    const actual = await vi.importActual<Record<string, unknown>>(
        '@perawallet/wallet-core-blockchain',
    )
    return {
        ...actual,
        useFetchSuggestedMinFee: () => mockFetchSuggestedMinFee,
        useMinimumFeeConfig: () => mockUseMinimumFeeConfig(),
    }
})

const transactions = [{ fee: 1000n }] as unknown as PeraTransaction[]
const assigned = { transactions, adjustments: [] }

type PlannerDeps = {
    accounts: WalletAccount[]
    configMinTxnFee: bigint
    pqMultiplier: bigint
    fetchSuggestedMinFee: () => Promise<bigint>
}

describe('useMinimumFeeCalculator', () => {
    const assignFeeToGroup = vi.fn(async () => assigned)

    beforeEach(() => {
        vi.clearAllMocks()
        liveStoreAccounts = []
        mockFetchSuggestedMinFee.mockResolvedValue(2000n)
        mockUseMinimumFeeConfig.mockReturnValue({
            minTxnFee: 1000n,
            pqMultiplier: 3n,
        })
        registerFakePlannerAdapter({ assignGroupFees: assignFeeToGroup })
    })

    it('hands the planner the params, the fee config and a fee fetcher that never throws', async () => {
        const { result } = renderHook(() => useMinimumFeeCalculator())
        const params = { transactions, signableIndices: [0] }

        const outcome = await result.current.assignFeeToGroup(params)

        expect(outcome).toBe(assigned)
        const [calledParams, deps] = assignFeeToGroup.mock
            .calls[0] as unknown as [typeof params, PlannerDeps]
        expect(calledParams).toBe(params)
        expect(deps.configMinTxnFee).toBe(1000n)
        expect(deps.pqMultiplier).toBe(3n)
        await expect(deps.fetchSuggestedMinFee()).resolves.toBe(2000n)
        expect(mockFetchSuggestedMinFee).toHaveBeenCalledWith({ fallback: 0n })
    })

    it('resolves accounts from live store state, not the value captured at render', async () => {
        liveStoreAccounts = [{ id: 'a1' } as WalletAccount]
        const { result } = renderHook(() => useMinimumFeeCalculator())
        const captured = result.current.assignFeeToGroup

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
})

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
import type { PeraTransaction } from '@perawallet/wallet-core-chain-contract'
import { registerFakePlannerAdapter } from '../../__tests__/fakePlannerAdapter'
import { useMinimumFeeCalculator } from '../useMinimumFeeCalculator'

vi.mock('@perawallet/wallet-core-chain-shared', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-chain-shared')
    >()),
    useNetwork: () => ({ network: 'mainnet' }),
}))

const transactions = [{ fee: 1000n }] as unknown as PeraTransaction[]
const assigned = { transactions, adjustments: [] }

describe('useMinimumFeeCalculator', () => {
    const assignFeeToGroup = vi.fn(async () => assigned)
    const chainHook = vi.fn(() => assignFeeToGroup)

    beforeEach(() => {
        vi.clearAllMocks()
        registerFakePlannerAdapter({ useAssignFeeToGroup: chainHook })
    })

    it('returns the planner hook assigner, called with the request untouched', async () => {
        const { result } = renderHook(() => useMinimumFeeCalculator())
        const params = { transactions, signableIndices: [0] }

        const outcome = await result.current.assignFeeToGroup(params)

        expect(result.current.assignFeeToGroup).toBe(assignFeeToGroup)
        expect(assignFeeToGroup).toHaveBeenCalledWith(params)
        expect(outcome).toBe(assigned)
    })
})

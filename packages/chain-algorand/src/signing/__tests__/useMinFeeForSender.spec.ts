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
import { resolveMinFeeForSender } from '../minFeeResolver'
import { useMinFeeForSender } from '../useMinFeeForSender'

const mockUseAllAccounts = vi.fn()
const mockUseSuggestedParametersQuery = vi.fn()
const mockUseMinimumFeeConfig = vi.fn()

vi.mock('@perawallet/wallet-core-accounts', async () => {
    const actual = await vi.importActual<object>(
        '@perawallet/wallet-core-accounts',
    )
    return {
        ...actual,
        useAllAccounts: () => mockUseAllAccounts(),
    }
})

vi.mock('@perawallet/wallet-core-blockchain', async () => {
    const actual = await vi.importActual<object>(
        '@perawallet/wallet-core-blockchain',
    )
    return {
        ...actual,
        useSuggestedParametersQuery: () => mockUseSuggestedParametersQuery(),
        useMinimumFeeConfig: () => mockUseMinimumFeeConfig(),
    }
})

const accounts = [{ id: 'q1', address: 'QADDR' }]

vi.mock('../minFeeResolver', () => ({
    resolveMinFeeForSender: vi.fn(() => 3000n),
}))

const resolveMinFee = vi.mocked(resolveMinFeeForSender)

describe('useMinFeeForSender', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockUseSuggestedParametersQuery.mockReturnValue({
            data: { minFee: 1000 },
            isPending: false,
        })
        mockUseMinimumFeeConfig.mockReturnValue({
            minTxnFee: 1000n,
            pqMultiplier: 3n,
        })
        mockUseAllAccounts.mockReturnValue(accounts)
        resolveMinFee.mockReturnValue(3000n)
    })

    it('hands the sender, wallet accounts, suggested fee and fee config to the resolver', () => {
        const { result } = renderHook(() => useMinFeeForSender('QADDR'))

        expect(resolveMinFee).toHaveBeenCalledWith({
            senderAddress: 'QADDR',
            accounts,
            suggestedMinFee: 1000n,
            configMinTxnFee: 1000n,
            pqMultiplier: 3n,
        })
        expect(result.current.minFee).toBe(3000n)
        expect(result.current.isPending).toBe(false)
    })

    it('returns undefined minFee while suggested params are pending', () => {
        mockUseSuggestedParametersQuery.mockReturnValue({
            data: undefined,
            isPending: true,
        })
        const { result } = renderHook(() => useMinFeeForSender('QADDR'))

        expect(result.current.minFee).toBeUndefined()
        expect(result.current.isPending).toBe(true)
    })

    it('returns undefined minFee when senderAddress is undefined', () => {
        const { result } = renderHook(() => useMinFeeForSender(undefined))

        expect(result.current.minFee).toBeUndefined()
    })
})

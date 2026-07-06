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

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import { renderHook } from '@testing-library/react'
import {
    AccountTypes,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
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

const quantum = (overrides: Partial<WalletAccount> = {}): WalletAccount =>
    ({
        id: 'q1',
        address: 'QADDR',
        type: AccountTypes.quantum,
        keyPairId: 'kp-quantum',
        ...overrides,
    }) as WalletAccount

const algo25 = (overrides: Partial<WalletAccount> = {}): WalletAccount =>
    ({
        id: 'a1',
        address: 'AADDR',
        type: AccountTypes.algo25,
        keyPairId: 'kp-algo25',
        ...overrides,
    }) as WalletAccount

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
        mockUseAllAccounts.mockReturnValue([])
    })

    it('resolves the multiplied fee for a quantum sender', () => {
        mockUseAllAccounts.mockReturnValue([quantum()])

        const { result } = renderHook(() => useMinFeeForSender('QADDR'))

        expect(result.current.minFee).toBe(3000n)
        expect(result.current.isPending).toBe(false)
    })

    it('resolves the base fee for an algo25 sender (regression)', () => {
        mockUseAllAccounts.mockReturnValue([algo25()])

        const { result } = renderHook(() => useMinFeeForSender('AADDR'))

        expect(result.current.minFee).toBe(1000n)
        expect(result.current.isPending).toBe(false)
    })

    it('returns undefined minFee while suggested params are pending', () => {
        mockUseSuggestedParametersQuery.mockReturnValue({
            data: undefined,
            isPending: true,
        })
        mockUseAllAccounts.mockReturnValue([quantum()])

        const { result } = renderHook(() => useMinFeeForSender('QADDR'))

        expect(result.current.minFee).toBeUndefined()
        expect(result.current.isPending).toBe(true)
    })

    it('returns undefined minFee when senderAddress is undefined', () => {
        mockUseAllAccounts.mockReturnValue([quantum()])

        const { result } = renderHook(() => useMinFeeForSender(undefined))

        expect(result.current.minFee).toBeUndefined()
    })
})

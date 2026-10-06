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

import { describe, expect, test, vi } from 'vitest'
import { renderHook } from '@testing-library/react'

const { mockUseMinimumFeeConfig, mockUseSuggestedParametersQuery } = vi.hoisted(
    () => ({
        mockUseMinimumFeeConfig: vi.fn(),
        mockUseSuggestedParametersQuery: vi.fn(),
    }),
)

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useMinimumFeeConfig: mockUseMinimumFeeConfig,
    useSuggestedParametersQuery: mockUseSuggestedParametersQuery,
}))

import {
    useAlgorandFeeConfig,
    useAlgorandSuggestedMinFeeQuery,
} from '../feeHooks'

describe('useAlgorandFeeConfig', () => {
    test('passes the fee floors through and names the asset MBR as the opt-in minimum balance', () => {
        mockUseMinimumFeeConfig.mockReturnValue({
            minTxnFee: 1000n,
            pqMultiplier: 3n,
            assetMbr: 100_000n,
            baseAccountMbr: 100_000n,
        })

        const { result } = renderHook(() => useAlgorandFeeConfig())

        expect(result.current).toEqual({
            minTxnFee: 1000n,
            pqMultiplier: 3n,
            assetOptInMinBalance: 100_000n,
        })
    })
})

describe('useAlgorandSuggestedMinFeeQuery', () => {
    test('returns the suggested minimum fee as a bigint once loaded', () => {
        mockUseSuggestedParametersQuery.mockReturnValue({
            data: { minFee: 1000n },
            isPending: false,
            isError: false,
        })

        const { result } = renderHook(() => useAlgorandSuggestedMinFeeQuery())

        expect(result.current).toEqual({
            suggestedMinFee: 1000n,
            isPending: false,
            isError: false,
        })
    })

    test('is undefined while pending', () => {
        mockUseSuggestedParametersQuery.mockReturnValue({
            data: undefined,
            isPending: true,
            isError: false,
        })

        const { result } = renderHook(() => useAlgorandSuggestedMinFeeQuery())

        expect(result.current).toEqual({
            suggestedMinFee: undefined,
            isPending: true,
            isError: false,
        })
    })

    test('keeps the last suggested fee when a refetch fails', () => {
        mockUseSuggestedParametersQuery.mockReturnValue({
            data: { minFee: 1000n },
            isPending: false,
            isError: true,
        })

        const { result } = renderHook(() => useAlgorandSuggestedMinFeeQuery())

        expect(result.current.suggestedMinFee).toBe(1000n)
        expect(result.current.isError).toBe(true)
    })
})

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

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import {
    ChainAdapterNotRegisteredError,
    LEGACY_CHAIN_ID,
    type ChainId,
} from '@perawallet/wallet-core-chain-contract'
import { registerFakePlannerAdapter } from '../../__tests__/fakePlannerAdapter'
import {
    useFeeConfig,
    useFetchSuggestedMinFee,
    useSuggestedMinFeeQuery,
} from '../chainFees'

const feeConfig = { minTxnFee: 1n, pqMultiplier: 2n, assetOptInMinBalance: 3n }
const suggestedMinFeeQuery = {
    suggestedMinFee: 4n,
    isPending: false,
    isError: false,
}
const fetchSuggestedMinFee = async () => 5n
const NO_PLANNER_CHAIN: ChainId = 'ethereum'

describe('chainFees', () => {
    const useChainFeeConfig = vi.fn(() => feeConfig)
    const useChainSuggestedMinFeeQuery = vi.fn(() => suggestedMinFeeQuery)
    const useChainFetchSuggestedMinFee = vi.fn(() => fetchSuggestedMinFee)

    beforeEach(() => {
        vi.clearAllMocks()
        registerFakePlannerAdapter({
            useFeeConfig: useChainFeeConfig,
            useSuggestedMinFeeQuery: useChainSuggestedMinFeeQuery,
            useFetchSuggestedMinFee: useChainFetchSuggestedMinFee,
        })
    })

    it('returns the registered planner chain value for each hook', async () => {
        const config = renderHook(() => useFeeConfig(LEGACY_CHAIN_ID))
        const query = renderHook(() => useSuggestedMinFeeQuery(LEGACY_CHAIN_ID))
        const fetcher = renderHook(() =>
            useFetchSuggestedMinFee(LEGACY_CHAIN_ID),
        )

        expect(config.result.current).toEqual(feeConfig)
        expect(query.result.current).toEqual(suggestedMinFeeQuery)
        expect(await fetcher.result.current()).toBe(5n)
    })

    it('gives neutral values on a chain with no planner, still running the registered hooks', async () => {
        const config = renderHook(() => useFeeConfig(NO_PLANNER_CHAIN))
        const query = renderHook(() =>
            useSuggestedMinFeeQuery(NO_PLANNER_CHAIN),
        )
        const fetcher = renderHook(() =>
            useFetchSuggestedMinFee(NO_PLANNER_CHAIN),
        )

        expect(config.result.current).toEqual({
            minTxnFee: 0n,
            pqMultiplier: 1n,
            assetOptInMinBalance: 0n,
        })
        expect(query.result.current).toEqual({
            suggestedMinFee: undefined,
            isPending: false,
            isError: false,
        })
        expect(await fetcher.result.current({ fallback: 9n })).toBe(9n)
        await expect(fetcher.result.current()).rejects.toBeInstanceOf(
            ChainAdapterNotRegisteredError,
        )
        expect(useChainFeeConfig).toHaveBeenCalledTimes(1)
        expect(useChainSuggestedMinFeeQuery).toHaveBeenCalledTimes(1)
        expect(useChainFetchSuggestedMinFee).toHaveBeenCalledTimes(1)
    })

    it('calls the same hooks when the chain changes between renders', () => {
        const { result, rerender } = renderHook(
            ({ chainId }: { chainId: ChainId }) => useFeeConfig(chainId),
            { initialProps: { chainId: LEGACY_CHAIN_ID as ChainId } },
        )
        expect(result.current).toEqual(feeConfig)

        rerender({ chainId: NO_PLANNER_CHAIN })

        expect(result.current.minTxnFee).toBe(0n)
        expect(useChainFeeConfig).toHaveBeenCalledTimes(2)
    })
})

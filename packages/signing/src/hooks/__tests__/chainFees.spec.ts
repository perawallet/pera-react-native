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

import { describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import {
    ChainAdapterNotRegisteredError,
    LEGACY_CHAIN_ID,
} from '@perawallet/wallet-core-chain-contract'
import { plannerChainAdapters } from '../../chain-adapter'
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

describe('chainFees', () => {
    it('returns the registered planner chain value for each hook', async () => {
        registerFakePlannerAdapter({
            useFeeConfig: vi.fn(() => feeConfig),
            useSuggestedMinFeeQuery: vi.fn(() => suggestedMinFeeQuery),
            useFetchSuggestedMinFee: vi.fn(() => fetchSuggestedMinFee),
        })

        const config = renderHook(() => useFeeConfig(LEGACY_CHAIN_ID))
        const query = renderHook(() => useSuggestedMinFeeQuery(LEGACY_CHAIN_ID))
        const fetcher = renderHook(() =>
            useFetchSuggestedMinFee(LEGACY_CHAIN_ID),
        )

        expect(config.result.current).toEqual(feeConfig)
        expect(query.result.current).toEqual(suggestedMinFeeQuery)
        expect(await fetcher.result.current()).toBe(5n)
    })

    it('throws ChainAdapterNotRegisteredError when no planner is registered', () => {
        plannerChainAdapters.reset()
        const silence = vi.spyOn(console, 'error').mockImplementation(() => {})

        expect(() => renderHook(() => useFeeConfig(LEGACY_CHAIN_ID))).toThrow(
            ChainAdapterNotRegisteredError,
        )
        expect(() =>
            renderHook(() => useSuggestedMinFeeQuery(LEGACY_CHAIN_ID)),
        ).toThrow(ChainAdapterNotRegisteredError)
        expect(() =>
            renderHook(() => useFetchSuggestedMinFee(LEGACY_CHAIN_ID)),
        ).toThrow(ChainAdapterNotRegisteredError)

        silence.mockRestore()
    })
})

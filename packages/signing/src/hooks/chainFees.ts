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

import { useCallback } from 'react'
import {
    ChainAdapterNotRegisteredError,
    type ChainId,
} from '@perawallet/wallet-core-chain-contract'

import type {
    ChainFeeConfig,
    FetchSuggestedMinFee,
    UseSuggestedMinFeeQueryResult,
} from '../chain-adapter'
import { usePlannerHook } from './usePlannerHook'

const NO_FEE_CONFIG: ChainFeeConfig = {
    minTxnFee: 0n,
    pqMultiplier: 1n,
    assetOptInMinBalance: 0n,
}

const NO_SUGGESTED_MIN_FEE: UseSuggestedMinFeeQueryResult = {
    suggestedMinFee: undefined,
    isPending: false,
    isError: false,
}

/** Zero fees on a chain with no planner. */
export const useFeeConfig = (chainId: ChainId): ChainFeeConfig =>
    usePlannerHook(chainId, NO_FEE_CONFIG, planner => planner.useFeeConfig())

/** No suggested fee, and nothing pending, on a chain with no planner. */
export const useSuggestedMinFeeQuery = (
    chainId: ChainId,
): UseSuggestedMinFeeQueryResult =>
    usePlannerHook(chainId, NO_SUGGESTED_MIN_FEE, planner =>
        planner.useSuggestedMinFeeQuery(),
    )

/**
 * On a chain with no planner the fetch fails as a failed network fetch does:
 * it resolves the caller's `fallback`, else rejects.
 */
export const useFetchSuggestedMinFee = (
    chainId: ChainId,
): FetchSuggestedMinFee => {
    const fetchWithoutPlanner = useCallback<FetchSuggestedMinFee>(
        async options => {
            if (options?.fallback !== undefined) return options.fallback
            throw new ChainAdapterNotRegisteredError('planner', chainId)
        },
        [chainId],
    )
    return usePlannerHook(chainId, fetchWithoutPlanner, planner =>
        planner.useFetchSuggestedMinFee(),
    )
}

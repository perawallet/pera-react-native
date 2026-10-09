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

import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import {
    plannerChainAdapters,
    type ChainFeeConfig,
    type FetchSuggestedMinFee,
    type UseSuggestedMinFeeQueryResult,
} from '../chain-adapter'

// The chain's hook runs as part of each of these, so `chainId` must not
// change across renders.
export const useFeeConfig = (chainId: ChainId): ChainFeeConfig => {
    const useChainFeeConfig = plannerChainAdapters.get(chainId).useFeeConfig
    return useChainFeeConfig()
}

export const useSuggestedMinFeeQuery = (
    chainId: ChainId,
): UseSuggestedMinFeeQueryResult => {
    const useChainSuggestedMinFeeQuery =
        plannerChainAdapters.get(chainId).useSuggestedMinFeeQuery
    return useChainSuggestedMinFeeQuery()
}

export const useFetchSuggestedMinFee = (
    chainId: ChainId,
): FetchSuggestedMinFee => {
    const useChainFetchSuggestedMinFee =
        plannerChainAdapters.get(chainId).useFetchSuggestedMinFee
    return useChainFetchSuggestedMinFee()
}

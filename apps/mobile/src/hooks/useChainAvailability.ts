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

import { useMemo } from 'react'
import { findNativeAsset, type PeraAsset } from '@perawallet/wallet-core-assets'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import { useIsChainSwitchedOff } from '@perawallet/wallet-core-chain-shared'

/**
 * Whether a chain's balances can be shown: not while its kill switch is on, nor
 * when this build ships no assets adapter for it, so no native asset to show.
 */
export type ChainAvailability =
    | { isAvailable: true; nativeAsset: PeraAsset }
    | { isAvailable: false }

export const useChainAvailability = (chainId: ChainId): ChainAvailability => {
    const isSwitchedOff = useIsChainSwitchedOff(chainId)
    return useMemo(() => {
        const nativeAsset = isSwitchedOff ? undefined : findNativeAsset(chainId)
        return nativeAsset
            ? { isAvailable: true, nativeAsset }
            : { isAvailable: false }
    }, [chainId, isSwitchedOff])
}

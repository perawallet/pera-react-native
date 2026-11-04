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

import { Decimal } from 'decimal.js'
import type { SwapChainAdapter } from '@perawallet/wallet-core-swaps'
import {
    fromCaip19,
    InvalidCaip19Error,
    toCaip19,
} from '../blockchain/utils/caip19'
import type { EvmChain } from '../chains/types'

/**
 * Receive-only: resolves this chain's router ids so a swap can pay out here,
 * but never runs one from here. The swap capability stays off for EVM chains.
 */
export const createEvmSwapAdapter = (chain: EvmChain): SwapChainAdapter => ({
    chainId: chain.row.id,
    nativeAssetId: chain.nativeAsset.assetId,
    defaultReceiveAssetId: chain.nativeAsset.assetId,
    toRouterAssetId: (assetId, scope) => toCaip19(assetId, scope, chain),
    fromRouterAssetId: (routerAssetId, scope) => {
        try {
            return fromCaip19(routerAssetId, scope, chain)
        } catch (error) {
            if (error instanceof InvalidCaip19Error) return null
            throw error
        }
    },
    maxAmountFeeReserve: new Decimal(0),
    swapExplorerUrl: () => undefined,
    executeSwap: async () => ({
        kind: 'failed',
        failure: { phase: 'prepare', reason: 'unsupported-steps' },
    }),
    supportsCosignedSwaps: false,
})

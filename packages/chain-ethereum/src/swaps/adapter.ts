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
import type { ChainContext } from '@perawallet/wallet-core-chain-contract'
import type { SwapChainAdapter } from '@perawallet/wallet-core-swaps'
import { evmAssetIdOfRouterId, toCaip19 } from '../blockchain/utils/caip19'
import { createEvmClient } from '../blockchain/utils/createEvmClient'
import type { EvmChain } from '../chains/types'
import { executeEvmSwap } from './execute-evm-swap'
import {
    estimateEvmSwapFeeReserve,
    estimateEvmSwapSourceCost,
} from './source-cost'

export const createEvmSwapAdapter = (
    ctx: ChainContext,
    chain: EvmChain,
): SwapChainAdapter => ({
    chainId: chain.row.id,
    nativeAssetId: chain.nativeAsset.assetId,
    defaultReceiveAssetId:
        chain.row.defaultSwapReceiveAssetId ?? chain.nativeAsset.assetId,
    toRouterAssetId: (assetId, scope) => toCaip19(assetId, scope, chain),
    fromRouterAssetId: (routerAssetId, scope) =>
        evmAssetIdOfRouterId(routerAssetId, scope, chain),
    maxAmountFeeReserve: scope =>
        estimateEvmSwapFeeReserve({
            client: createEvmClient(scope, ctx, chain),
            chain,
            scope,
        }),
    holdingReserve: () => new Decimal(0),
    estimateSourceCost: ({ quote, scope }) =>
        estimateEvmSwapSourceCost({
            client: createEvmClient(scope, ctx, chain),
            chain,
            quote,
            scope,
        }),
    executeSwap: (input, context) =>
        executeEvmSwap({ ctx, chain, input, context }),
    supportsCosignedSwaps: false,
})

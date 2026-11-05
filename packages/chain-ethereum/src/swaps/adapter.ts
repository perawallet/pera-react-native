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
import type { Address } from 'viem'
import type {
    ChainContext,
    ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import { displayUnitsToBaseUnits } from '@perawallet/wallet-core-shared'
import type { SwapChainAdapter } from '@perawallet/wallet-core-swaps'
import {
    fromCaip19,
    InvalidCaip19Error,
    toCaip19,
} from '../blockchain/utils/caip19'
import { createEvmClient } from '../blockchain/utils/createEvmClient'
import type { EvmChain } from '../chains/types'
import { executeEvmSwap } from './execute-evm-swap'
import { evmSwapRouteContractsOf } from './route-contracts'
import { estimateEvmSwapSourceCost } from './source-cost'

// Of the native unit: held back from a percentage amount for a swap's gas.
const MAX_AMOUNT_FEE_RESERVE = '0.005'

export type EvmSwapAdapterOptions = {
    routeContractsOf?: (scope: ChainScope) => readonly Address[]
}

export const createEvmSwapAdapter = (
    ctx: ChainContext,
    chain: EvmChain,
    { routeContractsOf = evmSwapRouteContractsOf }: EvmSwapAdapterOptions = {},
): SwapChainAdapter => ({
    chainId: chain.row.id,
    nativeAssetId: chain.nativeAsset.assetId,
    defaultReceiveAssetId:
        chain.row.defaultSwapReceiveAssetId ?? chain.nativeAsset.assetId,
    toRouterAssetId: (assetId, scope) => toCaip19(assetId, scope, chain),
    fromRouterAssetId: (routerAssetId, scope) => {
        try {
            return fromCaip19(routerAssetId, scope, chain)
        } catch (error) {
            if (error instanceof InvalidCaip19Error) return null
            throw error
        }
    },
    maxAmountFeeReserve: displayUnitsToBaseUnits(
        MAX_AMOUNT_FEE_RESERVE,
        chain.row.nativeAsset.decimals,
    ),
    holdingReserve: () => new Decimal(0),
    swapExplorerUrl: (scope, item) => {
        const swapTransaction = item.transactions.find(
            transaction =>
                transaction.role === 'swap' &&
                transaction.scope?.chainId === chain.row.id,
        )
        return swapTransaction
            ? chain.descriptor.explorer.transactionUrl(
                  scope.networkId,
                  swapTransaction.txHash,
              )
            : undefined
    },
    estimateSourceCost: ({ quote, scope }) =>
        estimateEvmSwapSourceCost({
            client: createEvmClient(scope, ctx, chain),
            chain,
            quote,
            scope,
            routeContracts: routeContractsOf(scope),
        }),
    executeSwap: (input, context) =>
        executeEvmSwap({
            ctx,
            chain,
            routeContracts: routeContractsOf(context.scope),
            input,
            context,
        }),
    supportsCosignedSwaps: false,
})

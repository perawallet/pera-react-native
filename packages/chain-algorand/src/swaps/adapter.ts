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

import { getAlgorandChainConfig } from '@perawallet/wallet-core-config'
import {
    decodeSignedTransaction,
    decodeTransaction,
    encodeSignedTransactions,
    getAlgorandClient,
} from '../blockchain'
import { Decimal } from 'decimal.js'

import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import {
    PeraServiceUnavailableError,
    toBigInt,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import type { SwapChainAdapter } from '@perawallet/wallet-core-swaps'
import { ALGORAND_CHAIN_ID } from '../chain-id'
import { algorandDescriptor } from '../descriptor'
import { algorandNetworkOf } from '../network-id'
import { algorandHoldingReserve } from '../transactions/spendable-balance'
import { executeAlgorandSwap } from './executeSwap'
import { isAlgorandQuantumSwapEnabled } from './quantumSwapGate'
import { useEnsureSwapAssetOptIn } from './useEnsureSwapAssetOptIn'
import type {
    PeraSignedTransaction,
    PeraTransaction,
} from '../blockchain/models/algosdk-shapes'

// Mainnet USDC on every network: the receive asset a fresh swap has always
// defaulted to.
const DEFAULT_RECEIVE_ASSET_ID = '31566704'

// Held back from a percentage amount for the group's network fees, in
// microAlgos: the same margin the group validator allows for them.
const MAX_AMOUNT_FEE_RESERVE_MICRO_ALGO = 100_000

const caip2Of = (scope: ChainScope): Nullable<string> =>
    algorandDescriptor.networks.find(
        network => network.id === algorandNetworkOf(scope),
    )?.caip2 ?? null

// CAIP-19 for an ASA; ALGO is `asa:0`, and a leading zero is not an id.
const ROUTER_ASSET_REFERENCE = /^asa:(0|[1-9]\d*)$/

// Swap groups arrive fully built from the backend, so the client only reads
// account state and submits; it never builds or signs with its own defaults.
export const algorandSwapAdapter: SwapChainAdapter = {
    chainId: ALGORAND_CHAIN_ID,
    nativeAssetId: algorandDescriptor.nativeAsset.ref.assetId,
    defaultReceiveAssetId: DEFAULT_RECEIVE_ASSET_ID,
    toRouterAssetId: (assetId, scope) => {
        const caip2 = caip2Of(scope)
        if (!caip2) throw new PeraServiceUnavailableError(scope)
        return `${caip2}/asa:${assetId}`
    },
    fromRouterAssetId: (routerAssetId, scope) => {
        const caip2 = caip2Of(scope)
        if (!caip2 || !routerAssetId.startsWith(`${caip2}/`)) return null
        const match = ROUTER_ASSET_REFERENCE.exec(
            routerAssetId.slice(caip2.length + 1),
        )
        return match ? match[1] : null
    },
    maxAmountFeeReserve: new Decimal(MAX_AMOUNT_FEE_RESERVE_MICRO_ALGO),
    holdingReserve: algorandHoldingReserve,
    // The router keeps no group id, so the link opens the swap transaction.
    swapExplorerUrl: (scope, item) => {
        const { explorerUrl } = getAlgorandChainConfig(scope)
        const swapTransaction = item.transactions.find(
            transaction =>
                transaction.role === 'swap' &&
                transaction.scope?.chainId === ALGORAND_CHAIN_ID,
        )
        return swapTransaction && explorerUrl
            ? `${explorerUrl}/tx/${swapTransaction.txHash}/`
            : undefined
    },
    estimateSourceCost: async () => null,
    useEnsureReceivable: useEnsureSwapAssetOptIn,
    executeSwap: (params, { scope, ...context }) =>
        executeAlgorandSwap(params, {
            ...context,
            scope,
            network: algorandNetworkOf(scope),
            algorandClient: getAlgorandClient(scope),
            assetMbr: toBigInt(algorandHoldingReserve(scope)),
            isQuantumSwapEnabled: isAlgorandQuantumSwapEnabled(),
            decodeTransaction: bytes =>
                decodeTransaction(bytes) as PeraTransaction,
            decodeSignedTransaction: bytes =>
                decodeSignedTransaction(bytes) as PeraSignedTransaction,
            encodeSignedTransactions,
        }),
    supportsCosignedSwaps: true,
}

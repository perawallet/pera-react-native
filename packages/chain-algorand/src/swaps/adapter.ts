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
import { toBigInt } from '@perawallet/wallet-core-shared'
import type { SwapChainAdapter } from '@perawallet/wallet-core-swaps'
import { ALGORAND_CHAIN_ID } from '../chain-id'
import { algorandDescriptor } from '../descriptor'
import { algorandNetworkOf } from '../network-id'
import { algorandHoldingReserve } from '../transactions/spendable-balance'
import { executeAlgorandSwap } from './executeSwap'
import { isAlgorandQuantumSwapEnabled } from './quantumSwapGate'
import type {
    PeraSignedTransaction,
    PeraTransaction,
} from '../blockchain/models/algosdk-shapes'

// Mainnet USDC on every network: the receive asset a fresh swap has always
// defaulted to.
const DEFAULT_RECEIVE_ASSET_ID = '31566704'

// Swap groups arrive fully built from the backend, so the client only reads
// account state and submits; it never builds or signs with its own defaults.
export const algorandSwapAdapter: SwapChainAdapter = {
    chainId: ALGORAND_CHAIN_ID,
    nativeAssetId: algorandDescriptor.nativeAsset.ref.assetId,
    defaultReceiveAssetId: DEFAULT_RECEIVE_ASSET_ID,
    swapExplorerUrl: (scope, item) => {
        const { explorerUrl } = getAlgorandChainConfig(scope)
        return item.transactionGroupId && explorerUrl
            ? `${explorerUrl}/tx-group/${item.transactionGroupId}/`
            : undefined
    },
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

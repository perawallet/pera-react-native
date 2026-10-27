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

import type { PeraAsset } from '@perawallet/wallet-core-assets'
import { ETHEREUM_CHAIN_ID, evmChainOf } from './chains/table'

export {
    createEthereumAccountStateOps,
    InvalidPrivateKeyError,
    parseEthereumPrivateKey,
    revealEthereumPrivateKey,
    type EthereumAccountStateOps,
} from './accounts'
export { createEthereumAssetsAdapter } from './assets'
export {
    createEvmClient,
    EVM_NFT_STANDARD_LABELS,
    EvmError,
    EvmErrorCode,
    evmHttpTransport,
    InvalidCaip19Error,
    isEvmError,
    parseEvmNftAssetId,
    toEvmError,
    toEvmNftAssetId,
    UnconfiguredEvmRpcError,
    UnknownEvmNetworkError,
    type EvmErrorParams,
    type EvmNftStandard,
} from './blockchain'
export { ETHEREUM_CHAIN_ID, EVM_CHAINS, evmChainOf } from './chains/table'
export type { EvmChain, EvmChainRow, EvmFeeStrategy } from './chains/types'
export { createEvmChainModule, ethereumModule, evmChainModules } from './module'
export { spendApprovalOfCall } from './signing/allowance'
export type {
    EvmNftItem,
    EvmStandardCall,
} from './signing/standard-call-types'
export {
    readEthereumNative,
    toEthereumNative,
    type EthereumTransactionView,
} from './signing/transaction-view'

/** Ethereum's native coin, for the Ethereum UI module. */
export const ETHEREUM_NATIVE_ASSET: PeraAsset =
    evmChainOf(ETHEREUM_CHAIN_ID).nativeAsset

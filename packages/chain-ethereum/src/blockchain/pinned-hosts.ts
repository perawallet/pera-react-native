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

import type {
    ChainPinnedHosts,
    EvmChainId,
} from '@perawallet/wallet-core-chain-contract'
import { chainEndpointsFor } from '@perawallet/wallet-core-config'
import type { EvmChain } from '../chains/types'

// Only hosts under these domains are pinned; any other build-time RPC URL,
// such as a public fallback, runs unpinned.
export const EVM_RPC_PIN_DOMAINS = ['perawallet.app'] as const

/** One kill switch per chain: the registry keys groups by flag, so a shared flag would keep only the last chain's hosts. */
export const evmSslPinningFlag = (chainId: EvmChainId): string =>
    `enable_ssl_pinning_${chainId}_rpc`

export const evmPinnedHosts = (chain: EvmChain): ChainPinnedHosts => ({
    flag: evmSslPinningFlag(chain.row.id),
    urls: Object.values(chainEndpointsFor(chain.row.id)).flat(),
    domains: EVM_RPC_PIN_DOMAINS,
})

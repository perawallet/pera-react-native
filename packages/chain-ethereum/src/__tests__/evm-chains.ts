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
    ChainScope,
    NetworkTier,
} from '@perawallet/wallet-core-chain-contract'
import { EVM_CHAINS, evmChainOf } from '../chains/table'
import type { EvmChain } from '../chains/types'

export const ETHEREUM: EvmChain = evmChainOf('ethereum')
export const BASE: EvmChain = evmChainOf('base')
export const POLYGON: EvmChain = evmChainOf('polygon')

/** Every row of the table, for specs that run per chain. */
export const EVM_TEST_CHAINS: readonly EvmChain[] = EVM_CHAINS

export const evmScopeOf = (
    chain: EvmChain,
    tier: NetworkTier = 'mainnet',
): ChainScope => {
    const network = chain.descriptor.networks.find(n => n.tier === tier)
    if (!network) throw new Error(`${chain.row.id} has no ${tier} network`)
    return { chainId: chain.row.id, networkId: network.id }
}

export const eip155IdOf = (
    chain: EvmChain,
    tier: NetworkTier = 'mainnet',
): number => {
    const network = chain.descriptor.networks.find(n => n.tier === tier)
    if (network?.nativeRef.kind !== 'evm') {
        throw new Error(`${chain.row.id} has no ${tier} network`)
    }
    return network.nativeRef.eip155ChainId
}

export { evmChainOf }

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

import { createPublicClient } from 'viem'
import type {
    ChainRequestTimeouts,
    NetworkId,
} from '@perawallet/wallet-core-chain-contract'
import type { EndpointOverrideCheck } from '@perawallet/wallet-core-chain-shared'
import type { EvmChain } from '../../chains/types'
import { eip155ChainIdOfNetwork } from './caip19'
import { evmHttpTransport } from './evmHttpTransport'

/** Whether `url` serves `networkId`, so an override can't point Sepolia at mainnet. */
export const checkEvmRpcChainId = async (
    url: string,
    networkId: NetworkId,
    timeouts: ChainRequestTimeouts,
    chain: EvmChain,
): Promise<EndpointOverrideCheck> => {
    const expected = eip155ChainIdOfNetwork(chain, networkId)
    let served: number
    try {
        served = await createPublicClient({
            transport: evmHttpTransport(url, {
                timeout: timeouts.readMs,
                retryCount: 0,
            }),
        }).getChainId()
    } catch {
        return 'unreachable'
    }
    return expected !== undefined && served === expected
        ? 'matches'
        : 'wrong-network'
}

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

import {
    CHAIN_CAPABILITIES,
    type ChainCapabilities,
    type ChainDescriptor,
    type ChainId,
    type ChainNetwork,
} from '@perawallet/wallet-core-chain-contract'
import { algorandDescriptor } from '@perawallet/wallet-core-chain-algorand/descriptor'

// `CHAIN_IDS` only lists shipped chains, so a second chain is a cast until one lands.
export const ETHEREUM_CHAIN_ID = 'ethereum' as ChainId

export const allCapabilities = (isEnabled: boolean): ChainCapabilities =>
    Object.fromEntries(
        CHAIN_CAPABILITIES.map(capability => [capability, isEnabled]),
    ) as ChainCapabilities

const ethereumNetwork = (
    network: Pick<ChainNetwork, 'id' | 'tier' | 'displayName'> &
        Partial<ChainNetwork>,
): ChainNetwork => ({
    isDefaultForTier: false,
    status: 'active',
    nativeRef: {
        kind: 'algorand',
        genesisId: network.id,
        genesisHash: `${network.id}-hash`,
    },
    ...network,
})

/** Mainnet, Sepolia, and a deprecated network that pickers must hide. */
export const fixtureEthereumDescriptor: ChainDescriptor = {
    ...algorandDescriptor,
    id: ETHEREUM_CHAIN_ID,
    displayName: 'Ethereum',
    networks: [
        ethereumNetwork({
            id: 'mainnet',
            tier: 'mainnet',
            displayName: 'Mainnet',
            isDefaultForTier: true,
        }),
        ethereumNetwork({
            id: 'sepolia',
            tier: 'testnet',
            displayName: 'Sepolia',
            isDefaultForTier: true,
        }),
        ethereumNetwork({
            id: 'goerli',
            tier: 'testnet',
            displayName: 'Goerli',
            status: 'deprecated',
        }),
    ],
}

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
    addressCodecs,
    CHAIN_CAPABILITIES,
    type ChainCapabilities,
    type ChainDescriptor,
    type ChainId,
    type ChainNetwork,
    LEGACY_CHAIN_ID,
} from '@perawallet/wallet-core-chain-contract'
import { fixtureCodec } from '@packages/chain-contract/src/__tests__/testing'
import { algorandDescriptor } from '@perawallet/wallet-core-chain-algorand/descriptor'
import { ethereumCapabilityDefaults } from '@packages/chain-ethereum/src/capability-defaults'
import { ethereumDescriptor } from '@packages/chain-ethereum/src/descriptor'
import { ethereumAddressCodec } from '@packages/chain-ethereum/src/accounts/address-codec'
import { getProvider } from '@perawallet/wallet-extension-provider'

export const ETHEREUM_CHAIN_ID: ChainId = 'ethereum'

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
    uriSchemes: ['ethereum'],
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

/**
 * The unit registry starts with Algorand alone; this adds the real Ethereum
 * descriptor at its shipped defaults, read from source so specs that mock
 * `wallet-core-assets` don't load the Ethereum adapters.
 */
export const registerEthereumChain = (): void => {
    const { chains } = getProvider()
    if (!chains.has(ETHEREUM_CHAIN_ID)) {
        chains.register(ethereumDescriptor, ethereumCapabilityDefaults)
    }
    if (!addressCodecs.has(ETHEREUM_CHAIN_ID)) {
        addressCodecs.register(ethereumAddressCodec)
    }
}

const ALGORAND_ADDRESS_SHAPE = /^[0-9a-zA-Z]{58}$/

/**
 * Stands in for the Algorand address codec, which the unit registry lacks.
 * Defaults to the address shape; pass `isValid` to decide per test. Call
 * `addressCodecs.reset()` afterwards.
 */
export const registerLegacyAddressCodec = (
    isValid: (address: string) => boolean = address =>
        ALGORAND_ADDRESS_SHAPE.test(address),
): void => {
    addressCodecs.reset()
    addressCodecs.register({
        ...fixtureCodec,
        chainId: LEGACY_CHAIN_ID,
        isValid,
    })
}

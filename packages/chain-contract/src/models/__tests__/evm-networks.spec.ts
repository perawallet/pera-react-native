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

import { describe, expect, it } from 'vitest'
import {
    EVM_CHAIN_NETWORKS,
    isChainId,
    isEvmChainId,
    isNetworkId,
    type EvmChainId,
} from '../identity'

const EVM_CHAIN_IDS = Object.keys(EVM_CHAIN_NETWORKS) as EvmChainId[]

describe('EVM_CHAIN_NETWORKS', () => {
    it('names only chain ids, never algorand', () => {
        expect(EVM_CHAIN_IDS.every(isChainId)).toBe(true)
        expect(EVM_CHAIN_IDS).not.toContain('algorand')
    })

    it('gives every EIP-155 id to exactly one network', () => {
        const ids = EVM_CHAIN_IDS.flatMap(chainId =>
            EVM_CHAIN_NETWORKS[chainId].networks.map(n => n.eip155ChainId),
        )

        expect(new Set(ids).size).toBe(ids.length)
    })

    it.each(EVM_CHAIN_IDS)('gives %s one mainnet and one testnet', chainId => {
        const { networks } = EVM_CHAIN_NETWORKS[chainId]

        expect(networks.map(n => n.tier).sort()).toEqual(['mainnet', 'testnet'])
        expect(networks.every(n => isNetworkId(n.id))).toBe(true)
    })

    it('keeps Ethereum on mainnet 1 and Sepolia', () => {
        expect(EVM_CHAIN_NETWORKS.ethereum.networks).toEqual([
            {
                id: 'mainnet',
                tier: 'mainnet',
                displayName: 'Mainnet',
                eip155ChainId: 1,
            },
            {
                id: 'sepolia',
                tier: 'testnet',
                displayName: 'Sepolia',
                eip155ChainId: 11_155_111,
            },
        ])
    })
})

describe('isEvmChainId', () => {
    it.each(EVM_CHAIN_IDS)('accepts %s', chainId => {
        expect(isEvmChainId(chainId)).toBe(true)
    })

    it.each(['algorand', 'optimism', '', 'toString'])('rejects %j', value => {
        expect(isEvmChainId(value)).toBe(false)
    })
})

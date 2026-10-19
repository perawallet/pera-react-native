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
    CHAIN_CAPABILITIES,
    createChainRegistry,
    type ChainCapabilities,
    type ChainDescriptor,
} from '@perawallet/wallet-core-chain-contract'
import { toAssetGroups } from '../transformers'
import type { AssetGroupsResponse } from '../schema'

const ALL_ON = Object.fromEntries(
    CHAIN_CAPABILITIES.map(capability => [capability, true]),
) as ChainCapabilities

const chains = createChainRegistry()
chains.register(
    {
        id: 'algorand',
        networks: [
            { id: 'mainnet', tier: 'mainnet', caip2: 'algorand:main' },
            { id: 'testnet', tier: 'testnet', caip2: 'algorand:test' },
        ],
    } as unknown as ChainDescriptor,
    ALL_ON,
)
chains.register(
    {
        id: 'ethereum',
        networks: [{ id: 'mainnet', tier: 'mainnet', caip2: 'eip155:1' }],
    } as unknown as ChainDescriptor,
    ALL_ON,
)

const group = (
    id: string,
    members: { chain_id: string; asset_id: string }[],
): AssetGroupsResponse['results'][number] => ({
    id,
    name: 'USD Coin',
    symbol: 'USDC',
    logo_url: 'https://example.com/usdc.png',
    members,
})

describe('toAssetGroups', () => {
    it('resolves each member to the scope its CAIP-2 id names', () => {
        const [usdc] = toAssetGroups(
            {
                results: [
                    group('usdc', [
                        { chain_id: 'algorand:main', asset_id: '31566704' },
                        { chain_id: 'eip155:1', asset_id: '0xA0b8' },
                    ]),
                ],
            },
            chains,
        )

        expect(usdc).toEqual({
            id: 'usdc',
            name: 'USD Coin',
            symbol: 'USDC',
            logoUrl: 'https://example.com/usdc.png',
            members: [
                {
                    scope: { chainId: 'algorand', networkId: 'mainnet' },
                    assetId: '31566704',
                },
                {
                    scope: { chainId: 'ethereum', networkId: 'mainnet' },
                    assetId: '0xA0b8',
                },
            ],
        })
    })

    it('keeps a test network member on its own test network', () => {
        const [usdc] = toAssetGroups(
            {
                results: [
                    group('usdc', [
                        { chain_id: 'algorand:test', asset_id: '10458941' },
                    ]),
                ],
            },
            chains,
        )

        expect(usdc?.members[0]?.scope).toEqual({
            chainId: 'algorand',
            networkId: 'testnet',
        })
    })

    it('drops members on unregistered networks, and groups left empty', () => {
        const groups = toAssetGroups(
            {
                results: [
                    group('usdc', [
                        { chain_id: 'eip155:1', asset_id: '0xA0b8' },
                        { chain_id: 'eip155:8453', asset_id: '0x8335' },
                    ]),
                    group('gone', [
                        { chain_id: 'solana:mainnet', asset_id: 'EPj' },
                    ]),
                ],
            },
            chains,
        )

        expect(groups.map(g => g.id)).toEqual(['usdc'])
        expect(groups[0]?.members).toHaveLength(1)
    })
})

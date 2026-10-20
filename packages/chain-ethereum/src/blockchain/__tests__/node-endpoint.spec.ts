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

import { describe, expect, it, vi } from 'vitest'
import type { ChainContext } from '@perawallet/wallet-core-chain-contract'
import { createEvmNodeEndpointAdapter } from '../node-endpoint'
import { checkEvmRpcChainId } from '../utils/checkEvmRpcChainId'
import { BASE, ETHEREUM } from '../../__tests__/evm-chains'

vi.mock('../utils/checkEvmRpcChainId', () => ({
    checkEvmRpcChainId: vi.fn(async () => 'matches'),
}))

const TIMEOUTS = { readMs: 1_000, submitMs: 2_000 }

const contextWith = (
    endpoints: () => Record<string, string>,
): ChainContext => ({
    getScope: () => ({ chainId: 'ethereum', networkId: 'mainnet' }),
    getEndpoints: endpoints,
    getPeraBackend: () => ({ baseUrl: '', services: new Set() }),
    timeouts: TIMEOUTS,
    kms: {} as ChainContext['kms'],
})

describe('createEvmNodeEndpointAdapter', () => {
    it('reads the endpoint live, so a changed record shows on the next call', () => {
        let endpoints: Record<string, string> = {
            sepolia: 'https://sepolia.rpc.test/',
        }
        const adapter = createEvmNodeEndpointAdapter(
            contextWith(() => endpoints),
            ETHEREUM,
        )
        expect(adapter.endpointUrl('sepolia')).toBe('https://sepolia.rpc.test/')

        endpoints = { sepolia: 'https://my-node.rpc.test/' }

        expect(adapter.endpointUrl('sepolia')).toBe('https://my-node.rpc.test/')
    })

    it('reports nothing for a network without an endpoint', () => {
        const adapter = createEvmNodeEndpointAdapter(
            contextWith(() => ({})),
            ETHEREUM,
        )

        expect(adapter.endpointUrl('mainnet')).toBeUndefined()
    })

    it('checks an override against the network with the read ceiling', async () => {
        const adapter = createEvmNodeEndpointAdapter(
            contextWith(() => ({})),
            ETHEREUM,
        )

        await expect(
            adapter.checkOverride?.('sepolia', 'https://my-node.rpc.test/'),
        ).resolves.toBe('matches')
        expect(checkEvmRpcChainId).toHaveBeenCalledWith(
            'https://my-node.rpc.test/',
            'sepolia',
            TIMEOUTS,
            ETHEREUM,
        )
    })

    it("serves its own chain and checks an override against that chain's ids", async () => {
        const adapter = createEvmNodeEndpointAdapter(
            contextWith(() => ({})),
            BASE,
        )

        expect(adapter.chainId).toBe('base')
        await adapter.checkOverride?.('sepolia', 'https://my-node.rpc.test/')
        expect(checkEvmRpcChainId).toHaveBeenLastCalledWith(
            'https://my-node.rpc.test/',
            'sepolia',
            TIMEOUTS,
            BASE,
        )
    })
})

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

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createChainRegistry } from '../chain-registry'
import type { ChainCapabilities } from '../models/capabilities'
import type { ChainDescriptor } from '../models/descriptor'
import type { ChainId, ChainNetwork, NetworkTier } from '../models/identity'
import { countsTowardFiatTotals, isTestTierScope } from '../network-selection'

vi.mock('../fiat-totals-policy', () => ({
    TEST_NETWORK_VALUE_COUNTS_IN_FIAT_TOTALS: true,
}))

const network = (id: string, tier: NetworkTier): ChainNetwork =>
    ({ id, tier, isDefaultForTier: true, status: 'active' }) as ChainNetwork

const descriptor = (id: string, testNetworkId: string): ChainDescriptor =>
    ({
        id: id as ChainId,
        networks: [
            network('mainnet', 'mainnet'),
            network(testNetworkId, 'testnet'),
        ],
    }) as unknown as ChainDescriptor

describe('countsTowardFiatTotals with test-network value counted', () => {
    const chains = createChainRegistry()
    const build = {} as ChainCapabilities

    beforeEach(() => {
        chains.reset()
    })

    describe.each([
        ['one chain', [descriptor('algorand', 'testnet')]],
        [
            'two chains',
            [
                descriptor('algorand', 'testnet'),
                descriptor('ethereum', 'sepolia'),
            ],
        ],
    ] as const)('with %s registered', (_label, descriptors) => {
        beforeEach(() => {
            descriptors.forEach(entry => chains.register(entry, build))
        })

        it('counts a test network, which is still test tier', () => {
            const scope = { chainId: 'algorand', networkId: 'testnet' }

            expect(countsTowardFiatTotals(chains, scope)).toBe(true)
            expect(isTestTierScope(chains, scope)).toBe(true)
        })

        it('counts mainnet', () => {
            expect(
                countsTowardFiatTotals(chains, {
                    chainId: 'algorand',
                    networkId: 'mainnet',
                }),
            ).toBe(true)
        })
    })
})

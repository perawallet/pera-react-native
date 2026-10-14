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

import { beforeEach, describe, expect, it } from 'vitest'
import { createChainRegistry } from '../chain-registry'
import type { ChainCapabilities } from '../models/capabilities'
import type { ChainDescriptor } from '../models/descriptor'
import type { ChainId, ChainNetwork, NetworkTier } from '../models/identity'
import {
    chainModeFor,
    isTestTierScope,
    networkIdForMode,
    networkTierForMode,
    networkTierOf,
} from '../network-selection'

const network = (
    id: string,
    tier: NetworkTier,
    isDefaultForTier: boolean,
    status: ChainNetwork['status'] = 'active',
): ChainNetwork => ({ id, tier, isDefaultForTier, status }) as ChainNetwork

const descriptor = (id: string, networks: ChainNetwork[]): ChainDescriptor =>
    ({ id: id as ChainId, networks }) as unknown as ChainDescriptor

const algorandLike = descriptor('algorand', [
    network('mainnet', 'mainnet', true),
    network('testnet', 'testnet', true),
    network('betanet', 'testnet', false),
    network('custom', 'testnet', false),
])

const ethereumLike = descriptor('ethereum', [
    network('mainnet', 'mainnet', true),
    network('goerli', 'testnet', false, 'deprecated'),
    network('sepolia', 'testnet', true),
])

describe('networkIdForMode', () => {
    it.each([
        ['live', algorandLike, undefined, 'mainnet'],
        ['live', algorandLike, 'betanet', 'mainnet'],
        ['live', algorandLike, 'custom', 'mainnet'],
        ['live', ethereumLike, undefined, 'mainnet'],
        ['live', ethereumLike, 'sepolia', 'mainnet'],
        ['developer', algorandLike, undefined, 'testnet'],
        ['developer', algorandLike, 'betanet', 'betanet'],
        ['developer', algorandLike, 'custom', 'custom'],
        ['developer', ethereumLike, undefined, 'sepolia'],
        ['developer', ethereumLike, 'goerli', 'goerli'],
    ] as const)(
        '%s with override %s on chain %#: resolves to %s',
        (mode, chain, override, expected) => {
            expect(networkIdForMode(chain, mode, override)).toBe(expected)
        },
    )

    it('names the chain and tier when a tier has no default', () => {
        const mainnetOnly = descriptor('ethereum', [
            network('mainnet', 'mainnet', true),
        ])

        expect(() => networkIdForMode(mainnetOnly, 'developer')).toThrow(
            'Chain "ethereum" has no default testnet network',
        )
    })
})

describe('networkTierForMode', () => {
    it.each([
        ['live', 'mainnet'],
        ['developer', 'testnet'],
    ] as const)('%s maps to the %s tier', (mode, tier) => {
        expect(networkTierForMode(mode)).toBe(tier)
    })
})

describe('chainModeFor', () => {
    it.each([
        ['live', algorandLike, undefined, 'live'],
        ['live', algorandLike, 'betanet', 'live'],
        ['live', algorandLike, 'unlisted', 'live'],
        ['developer', algorandLike, undefined, 'developer'],
        ['developer', algorandLike, 'testnet', 'developer'],
        ['developer', ethereumLike, 'sepolia', 'developer'],
        ['developer', algorandLike, 'betanet', 'developer-override'],
        ['developer', ethereumLike, 'goerli', 'developer-override'],
        ['developer', algorandLike, 'my-node', 'developer-override'],
    ] as const)(
        '%s with override %s on chain %#: is %s',
        (mode, chain, override, expected) => {
            expect(chainModeFor(chain, mode, override)).toBe(expected)
        },
    )

    it('does not throw for a descriptor with no networks', () => {
        expect(chainModeFor(descriptor('algorand', []), 'developer')).toBe(
            'developer',
        )
    })
})

describe('networkTierOf', () => {
    it.each([
        [algorandLike, 'mainnet', 'mainnet'],
        [algorandLike, 'testnet', 'testnet'],
        [ethereumLike, 'sepolia', 'testnet'],
        [ethereumLike, 'goerli', 'testnet'],
    ] as const)('chain %#: %s is %s', (chain, networkId, expected) => {
        expect(networkTierOf(chain, networkId)).toBe(expected)
    })

    it('has no tier for a network the descriptor does not list', () => {
        expect(networkTierOf(ethereumLike, 'custom')).toBeUndefined()
    })
})

describe('isTestTierScope', () => {
    const chains = createChainRegistry()
    const build = {} as ChainCapabilities

    beforeEach(() => {
        chains.reset()
    })

    it('is false with one chain registered, whatever its network', () => {
        chains.register(algorandLike, build)

        expect(
            isTestTierScope(chains, {
                chainId: 'algorand',
                networkId: 'testnet',
            }),
        ).toBe(false)
    })

    it('is false while no chain is registered', () => {
        expect(
            isTestTierScope(chains, {
                chainId: 'algorand',
                networkId: 'testnet',
            }),
        ).toBe(false)
    })

    describe('with a second chain registered', () => {
        beforeEach(() => {
            chains.register(algorandLike, build)
            chains.register(ethereumLike, build)
        })

        it.each([
            ['algorand', 'mainnet', false],
            ['ethereum', 'mainnet', false],
            ['algorand', 'testnet', true],
            ['ethereum', 'sepolia', true],
            ['ethereum', 'goerli', true],
            ['algorand', 'my-node', true],
        ] as const)('%s/%s is %s', (chainId, networkId, expected) => {
            expect(isTestTierScope(chains, { chainId, networkId })).toBe(
                expected,
            )
        })

        it('is false for a chain that is not registered', () => {
            chains.reset()
            chains.register(algorandLike, build)
            chains.register(
                descriptor('fixture', [network('mainnet', 'mainnet', true)]),
                build,
            )

            expect(
                isTestTierScope(chains, {
                    chainId: 'ethereum',
                    networkId: 'sepolia',
                }),
            ).toBe(false)
        })
    })
})

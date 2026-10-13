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
import type { ChainDescriptor } from '../models/descriptor'
import type { ChainId, ChainNetwork, NetworkTier } from '../models/identity'
import {
    chainModeFor,
    networkIdForMode,
    networkTierForMode,
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

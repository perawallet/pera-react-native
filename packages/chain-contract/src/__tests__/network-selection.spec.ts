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
import { networkIdForGlobal } from '../network-selection'

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

describe('networkIdForGlobal', () => {
    it.each([
        ['mainnet', algorandLike, 'mainnet'],
        ['testnet', algorandLike, 'testnet'],
        ['mainnet', ethereumLike, 'mainnet'],
        ['testnet', ethereumLike, 'sepolia'],
    ] as const)(
        '%s resolves to the tier default on %s',
        (globalNetwork, chain, expected) => {
            expect(networkIdForGlobal(chain, globalNetwork, true)).toBe(
                expected,
            )
        },
    )

    it('resolves custom to the custom network when the chain supports it', () => {
        expect(networkIdForGlobal(algorandLike, 'custom', true)).toBe('custom')
    })

    it('resolves custom to the testnet default when the chain has no custom networks', () => {
        expect(networkIdForGlobal(ethereumLike, 'custom', false)).toBe(
            'sepolia',
        )
    })

    it('names the chain and tier when a tier has no default', () => {
        const mainnetOnly = descriptor('ethereum', [
            network('mainnet', 'mainnet', true),
        ])

        expect(() => networkIdForGlobal(mainnetOnly, 'testnet', true)).toThrow(
            'Chain "ethereum" has no default testnet network',
        )
    })
})

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

import { describe, it, expect } from 'vitest'
import type { RampPair } from '@perawallet/wallet-core-onramp'
import { ALGO_ASSET_NAME } from '@perawallet/wallet-core-shared'
import { resolveDestinationAssetId } from '../onrampFormHelpers'

const pairWithDestination = (id: string, symbol: string): RampPair =>
    ({
        id: `pair-${symbol}`,
        sourceToken: {
            id: 'USD',
            symbol: 'USD',
            name: 'US Dollar',
            fractionDecimals: 2,
            logo: null,
            network: { id: 'fiat', name: 'Fiat', logo: null },
            priceInUsd: null,
        },
        destinationToken: {
            id,
            symbol,
            name: symbol,
            fractionDecimals: 6,
            logo: null,
            network: { id: 'algorand', name: 'Algorand', logo: null },
            priceInUsd: null,
        },
        provider: { id: 'meld', paymentTypes: ['CARD'], limits: null },
    }) as RampPair

describe('resolveDestinationAssetId', () => {
    it('resolves the network-correct ASA id for a USDC destination', () => {
        expect(
            resolveDestinationAssetId(
                pairWithDestination('USDC_ALGORAND', 'USDC'),
                'mainnet',
            ),
        ).toBe(31_566_704n)
        expect(
            resolveDestinationAssetId(
                pairWithDestination('USDC_ALGORAND', 'USDC'),
                'testnet',
            ),
        ).toBe(10_458_941n)
    })

    it('returns null where the network has no known USDC id', () => {
        // There is no ASA to opt into off the Pera-backed lane. Returning
        // TestNet's id here would aim an opt-in at an asset that does not
        // exist on the active chain.
        expect(
            resolveDestinationAssetId(
                pairWithDestination('USDC_ALGORAND', 'USDC'),
                'betanet',
            ),
        ).toBeNull()
        expect(
            resolveDestinationAssetId(
                pairWithDestination('USDC_ALGORAND', 'USDC'),
                'custom',
            ),
        ).toBeNull()
    })

    it('needs no known id at all for an ALGO destination', () => {
        expect(
            resolveDestinationAssetId(
                pairWithDestination('ALGO', 'ALGO'),
                'betanet',
            ),
        ).toBe(ALGO_ASSET_NAME)
    })
})

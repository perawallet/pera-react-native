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

import { describe, test, expect } from 'vitest'
import {
    scopeForLegacyNetwork,
    type ChainScope,
} from '@perawallet/wallet-core-chain-contract'

import { getKnownAssetId } from '../assets'

describe('known asset ids', () => {
    test('getKnownAssetId returns null where the asset has no known id', () => {
        expect(getKnownAssetId('USDC', scopeForLegacyNetwork('mainnet'))).toBe(
            '31566704',
        )
        expect(getKnownAssetId('USDC', scopeForLegacyNetwork('testnet'))).toBe(
            '10458941',
        )
        // Was TestNet's id, which does not identify USDC on these chains.
        expect(
            getKnownAssetId('USDC', scopeForLegacyNetwork('betanet')),
        ).toBeNull()
        expect(
            getKnownAssetId('USDC', scopeForLegacyNetwork('custom')),
        ).toBeNull()
    })

    test('getKnownAssetId returns null for a network no chain declares', () => {
        expect(
            getKnownAssetId('USDC', {
                ...scopeForLegacyNetwork('mainnet'),
                networkId: 'fnet',
            }),
        ).toBeNull()
    })

    test('getKnownAssetId returns null, without throwing, for a chain that is not compiled in', () => {
        const scope = {
            chainId: 'unknown',
            networkId: 'mainnet',
        } as unknown as ChainScope

        expect(() => getKnownAssetId('USDC', scope)).not.toThrow()
        expect(getKnownAssetId('USDC', scope)).toBeNull()
    })
})

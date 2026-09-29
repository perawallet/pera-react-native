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
    scopeForLegacyNetwork,
    type ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import { algorandNetworkOf } from '../legacy-network'

describe('algorandNetworkOf', () => {
    it('returns the legacy network for an Algorand scope', () => {
        expect(algorandNetworkOf(scopeForLegacyNetwork('mainnet'))).toBe(
            'mainnet',
        )
        expect(algorandNetworkOf(scopeForLegacyNetwork('testnet'))).toBe(
            'testnet',
        )
    })

    it('rejects a scope from another chain', () => {
        const foreignScope = {
            chainId: 'other-chain',
            networkId: 'mainnet',
        } as unknown as ChainScope

        expect(() => algorandNetworkOf(foreignScope)).toThrow(
            'Not an Algorand scope: other-chain/mainnet',
        )
    })

    it('rejects a networkId with no legacy Network equivalent', () => {
        expect(() =>
            algorandNetworkOf({ chainId: 'algorand', networkId: 'unknown' }),
        ).toThrow('Not an Algorand scope: algorand/unknown')
    })
})

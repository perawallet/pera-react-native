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
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import {
    ALGORAND_NETWORK_IDS,
    algorandNetworkOf,
    algorandScope,
} from '../network-id'

describe('algorandScope', () => {
    it.each(ALGORAND_NETWORK_IDS)(
        'round-trips %s through algorandNetworkOf',
        networkId => {
            const scope = algorandScope(networkId)

            expect(scope).toEqual({ chainId: 'algorand', networkId })
            expect(algorandNetworkOf(scope)).toBe(networkId)
        },
    )
})

describe('algorandNetworkOf', () => {
    it('rejects a scope from another chain', () => {
        const foreignScope = {
            chainId: 'other-chain',
            networkId: 'mainnet',
        } as unknown as ChainScope

        expect(() => algorandNetworkOf(foreignScope)).toThrow(
            'Not an Algorand scope: other-chain/mainnet',
        )
        expect(() =>
            algorandNetworkOf({ chainId: 'ethereum', networkId: 'mainnet' }),
        ).toThrow('Not an Algorand scope: ethereum/mainnet')
    })

    it('rejects an Algorand network id the chain does not know', () => {
        expect(() =>
            algorandNetworkOf({ chainId: 'algorand', networkId: 'fnet' }),
        ).toThrow('Not an Algorand scope: algorand/fnet')
    })
})

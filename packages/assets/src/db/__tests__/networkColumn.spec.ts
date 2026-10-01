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
import { InvalidScopeKeyError } from '@perawallet/wallet-core-chain-contract'
import { networkColumnValue, scopeFromNetworkColumn } from '../networkColumn'

describe('network column encoding', () => {
    it.each(['mainnet', 'testnet', 'betanet', 'custom'])(
        'stores the Algorand %s scope as the bare network',
        network => {
            expect(
                networkColumnValue({ chainId: 'algorand', networkId: network }),
            ).toBe(network)
        },
    )

    it.each(['mainnet', 'testnet', 'betanet', 'custom'])(
        'decodes a bare %s value to the Algorand scope',
        network => {
            expect(scopeFromNetworkColumn(network)).toEqual({
                chainId: 'algorand',
                networkId: network,
            })
        },
    )

    it('decodes a scope key', () => {
        expect(scopeFromNetworkColumn('algorand/testnet')).toEqual({
            chainId: 'algorand',
            networkId: 'testnet',
        })
    })

    it('rejects a bare value that is not a known network', () => {
        expect(() => scopeFromNetworkColumn('devnet')).toThrow(
            InvalidScopeKeyError,
        )
    })

    it('rejects a scope key for an unknown chain', () => {
        expect(() => scopeFromNetworkColumn('ethereum/mainnet')).toThrow(
            InvalidScopeKeyError,
        )
    })
})

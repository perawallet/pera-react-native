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
import { KNOWN_ASSET_IDS } from '@perawallet/wallet-core-assets'
import { toScopeKey } from '@perawallet/wallet-core-chain-contract'
import { algorandDescriptor } from '../descriptor'

const scopeKeyOf = (networkId: string) =>
    toScopeKey({ chainId: algorandDescriptor.id, networkId })

describe('known asset ids', () => {
    it.each(algorandDescriptor.networks.map(network => network.id))(
        'declares a USDC entry for %s',
        networkId => {
            expect(KNOWN_ASSET_IDS.USDC.has(scopeKeyOf(networkId))).toBe(true)
        },
    )

    it('keeps the MainNet and TestNet USDC ids', () => {
        expect(KNOWN_ASSET_IDS.USDC.get(scopeKeyOf('mainnet'))).toBe(
            '31566704',
        )
        expect(KNOWN_ASSET_IDS.USDC.get(scopeKeyOf('testnet'))).toBe(
            '10458941',
        )
    })
})

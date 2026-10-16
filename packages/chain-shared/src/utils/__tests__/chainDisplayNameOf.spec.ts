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
    CHAIN_CAPABILITIES,
    type ChainCapabilities,
    type ChainDescriptor,
} from '@perawallet/wallet-core-chain-contract'
import { getProvider } from '@perawallet/wallet-extension-provider'
import { chainDisplayNameOf } from '../chainDisplayNameOf'

const ALL_ON = Object.fromEntries(
    CHAIN_CAPABILITIES.map(capability => [capability, true]),
) as ChainCapabilities

describe('chainDisplayNameOf', () => {
    it("reads a registered chain's display name", () => {
        getProvider().chains.register(
            {
                id: 'ethereum',
                displayName: 'Ethereum',
                networks: [],
            } as unknown as ChainDescriptor,
            ALL_ON,
        )

        expect(chainDisplayNameOf('ethereum')).toBe('Ethereum')
    })

    it('has no name for a chain this build does not register', () => {
        expect(chainDisplayNameOf('ethereum')).toBeUndefined()
    })
})

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
import { createFakeChainRegistry } from '../../__tests__/fakeChains'
import { registrationChainOf } from '../registrationChain'

const chains = createFakeChainRegistry({
    algorand: { mainnet: 'first:main', testnet: 'first:test' },
    ethereum: { mainnet: 'second:main', testnet: 'second:test' },
})

describe('registrationChainOf', () => {
    it.each([
        ['live', 'algorand', 'first:main'],
        ['developer', 'algorand', 'first:test'],
        ['live', 'ethereum', 'second:main'],
        ['developer', 'ethereum', 'second:test'],
    ] as const)(
        'names %s %s by its tier default network',
        (deployment, chainId, expected) => {
            expect(registrationChainOf(chains, chainId, deployment)).toBe(
                expected,
            )
        },
    )

    it('names no chain that is not registered', () => {
        expect(registrationChainOf(chains, 'base', 'live')).toBeNull()
    })
})

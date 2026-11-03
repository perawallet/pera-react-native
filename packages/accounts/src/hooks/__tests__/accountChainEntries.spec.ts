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

import { describe, expect, it, vi } from 'vitest'

vi.mock('@perawallet/wallet-extension-provider', () => ({
    getProvider: () => ({
        chains: {
            list: () => [
                { id: 'algorand' },
                { id: 'ethereum' },
                { id: 'base' },
            ],
        },
    }),
}))

import { otherRegisteredChainIds } from '../accountChainEntries'

describe('otherRegisteredChainIds', () => {
    it('lists every registered chain but the home one, in registry order', () => {
        expect(otherRegisteredChainIds('ethereum')).toEqual([
            'algorand',
            'base',
        ])
    })
})

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
import { unionTokenSets } from '../tokenSets'

describe('unionTokenSets', () => {
    it('returns the first map itself when the second adds nothing', () => {
        const held = { 'ethereum/mainnet': { '0xa': ['0x1', '0x2'] } }

        expect(
            unionTokenSets(held, { 'ethereum/mainnet': { '0xa': ['0x2'] } }),
        ).toBe(held)
    })

    it('unites the ids of one address sorted and without repeats', () => {
        expect(
            unionTokenSets(
                { 'ethereum/mainnet': { '0xa': ['0x3', '0x1'] } },
                { 'ethereum/mainnet': { '0xa': ['0x2', '0x1'] } },
            ),
        ).toEqual({ 'ethereum/mainnet': { '0xa': ['0x1', '0x2', '0x3'] } })
    })

    it('carries over a scope and an address only the second map has', () => {
        expect(
            unionTokenSets(
                { 'ethereum/mainnet': { '0xa': ['0x1'] } },
                {
                    'ethereum/mainnet': { '0xb': ['0x2'] },
                    'unknown/net': { '0xa': ['0x3'] },
                },
            ),
        ).toEqual({
            'ethereum/mainnet': { '0xa': ['0x1'], '0xb': ['0x2'] },
            'unknown/net': { '0xa': ['0x3'] },
        })
    })

    it('adds no entry for an empty list', () => {
        const held = {}

        expect(
            unionTokenSets(held, { 'ethereum/mainnet': { '0xa': [] } }),
        ).toBe(held)
    })
})

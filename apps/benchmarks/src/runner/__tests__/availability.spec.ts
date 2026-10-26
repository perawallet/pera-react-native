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
import { availableScenarios } from '../availability'
import type { Scenario } from '../types'

const scenario = (id: string, requiresChain?: string): Scenario => ({
    id,
    group: 'signing',
    title: id,
    scales: ['S'],
    requiresChain,
    setup: async () => {},
    run: async () => {},
})

describe('availableScenarios', () => {
    const all = [scenario('signing.a'), scenario('signing.eth', 'ethereum')]

    it('keeps every scenario that needs no particular chain', () => {
        expect(availableScenarios(all, ['algorand']).map(s => s.id)).toEqual([
            'signing.a',
        ])
    })

    it('adds a scenario once the build enables the chain it needs', () => {
        expect(
            availableScenarios(all, ['algorand', 'ethereum']).map(s => s.id),
        ).toEqual(['signing.a', 'signing.eth'])
    })
})

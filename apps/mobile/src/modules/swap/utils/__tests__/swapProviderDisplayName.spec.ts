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
import { swapProviderDisplayName } from '../swapProviderDisplayName'

describe('swapProviderDisplayName', () => {
    it.each([
        ['tinyman', 'Tinyman'],
        ['tinyman-v2', 'Tinyman v2'],
        ['vestige-v4', 'Vestige v4'],
        ['Folks-Router', 'Folks Router'],
        ['DEFLEX', 'Deflex'],
        ['haystack', 'Haystack'],
        ['new-router', 'new-router'],
    ])('names %s as %s', (provider, name) => {
        expect(swapProviderDisplayName(provider)).toBe(name)
    })

    it("prefers the router's display name", () => {
        expect(swapProviderDisplayName('deflex', 'Hay Router')).toBe(
            'Hay Router',
        )
    })

    it('falls back when the router gives a null display name', () => {
        expect(swapProviderDisplayName('xo', null)).toBe('XO Swap')
    })
})

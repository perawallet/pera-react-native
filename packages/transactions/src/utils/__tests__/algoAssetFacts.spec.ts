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
import { resolveAssetFacts } from '../algoAssetFacts'

const PLACEHOLDER = { unitName: 'asset(0)', decimals: 0 }

describe('resolveAssetFacts', () => {
    it('overrides the supplied facts for ALGO', () => {
        expect(resolveAssetFacts('0', PLACEHOLDER)).toEqual({
            unitName: 'ALGO',
            decimals: 6,
        })
    })

    it('recognizes the numeric id that pre-migration rows still hold', () => {
        expect(resolveAssetFacts(0, PLACEHOLDER)).toEqual({
            unitName: 'ALGO',
            decimals: 6,
        })
    })

    it('leaves a non-ALGO asset untouched', () => {
        const facts = { unitName: 'asset(31566704)', decimals: 0 }

        expect(resolveAssetFacts('31566704', facts)).toEqual(facts)
    })

    it('leaves an id above 2^53 untouched', () => {
        const facts = { unitName: 'BIG', decimals: 2 }

        expect(resolveAssetFacts('18446744073709551615', facts)).toEqual(facts)
    })

    it.each([null, undefined, ''])('treats %p as not ALGO', id => {
        const facts = { unitName: '', decimals: 6 }

        expect(resolveAssetFacts(id, facts)).toEqual(facts)
    })
})

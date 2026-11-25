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
import { Decimal } from 'decimal.js'
import { spentFirst } from '../spent-first'

const leg = (id: string, value: number) => ({ id, value: new Decimal(value) })

describe('spentFirst', () => {
    it('puts spent legs first, keeping the order within each side', () => {
        const legs = [leg('a', 1), leg('b', -1), leg('c', 2), leg('d', -2)]

        expect(spentFirst(legs).map(({ id }) => id)).toEqual([
            'b',
            'd',
            'a',
            'c',
        ])
    })

    it('leaves the given list as it was', () => {
        const legs = [leg('a', 1), leg('b', -1)]

        spentFirst(legs)

        expect(legs.map(({ id }) => id)).toEqual(['a', 'b'])
    })
})

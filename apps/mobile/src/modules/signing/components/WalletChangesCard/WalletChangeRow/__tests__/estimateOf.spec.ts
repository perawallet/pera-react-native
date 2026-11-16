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

import { Decimal } from 'decimal.js'
import { describe, expect, it } from 'vitest'
import { estimateOf } from '../estimateOf'

describe('estimateOf', () => {
    it('leaves an amount of 6 decimals or fewer as it is', () => {
        expect(estimateOf(new Decimal('1.123456')).toFixed()).toBe('1.123456')
    })

    it('cuts a longer amount down to 6 decimals, never rounding up', () => {
        expect(estimateOf(new Decimal('1.1234569')).toFixed()).toBe('1.123456')
    })

    it('keeps 2 significant digits of dust that 6 decimals would show as zero', () => {
        expect(estimateOf(new Decimal('0.0000001234')).toFixed()).toBe(
            '0.00000012',
        )
    })
})

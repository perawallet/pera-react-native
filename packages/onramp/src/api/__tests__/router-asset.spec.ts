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

import { isQuotableRampAmount } from '../router-asset'

describe('isQuotableRampAmount', () => {
    it('accepts an amount of at least one base unit', () => {
        expect(isQuotableRampAmount(new Decimal('0.000001'), 6)).toBe(true)
        expect(isQuotableRampAmount(new Decimal('12.5'), 2)).toBe(true)
    })

    it('rejects an amount that floors to zero base units', () => {
        expect(isQuotableRampAmount(new Decimal('0.0000009'), 6)).toBe(false)
        expect(isQuotableRampAmount(new Decimal('0.001'), 2)).toBe(false)
    })

    it('rejects zero and negative amounts', () => {
        expect(isQuotableRampAmount(new Decimal(0), 6)).toBe(false)
        expect(isQuotableRampAmount(new Decimal('-1'), 6)).toBe(false)
    })
})

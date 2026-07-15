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
import { Decimal } from 'decimal.js'
import { percentChange } from '../index'

describe('percentChange', () => {
    it('returns a positive signed change when last is greater than first', () => {
        const result = percentChange(new Decimal(100), new Decimal(150))
        expect(result.toNumber()).toBe(50)
    })

    it('returns a negative signed change when last is less than first', () => {
        const result = percentChange(new Decimal(100), new Decimal(50))
        expect(result.toNumber()).toBe(-50)
    })

    it('returns 0 when the base (first) is zero', () => {
        const result = percentChange(new Decimal(0), new Decimal(50))
        expect(result.toNumber()).toBe(0)
    })

    it('returns 0 when first equals last', () => {
        const result = percentChange(new Decimal(120), new Decimal(120))
        expect(result.toNumber()).toBe(0)
    })
})

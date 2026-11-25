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
import { rowAmountPrecision } from '../amounts'

describe('rowAmountPrecision', () => {
    it('rounds an 18-decimal amount to a few significant digits, which keep a small amount whole', () => {
        expect(rowAmountPrecision(18)).toBe('rowSignificant')
        expect(rowAmountPrecision(7)).toBe('rowSignificant')
    })

    it('keeps the compact row for an asset with at most 6 decimals', () => {
        expect(rowAmountPrecision(6)).toBe('compact')
        expect(rowAmountPrecision(0)).toBe('compact')
    })
})

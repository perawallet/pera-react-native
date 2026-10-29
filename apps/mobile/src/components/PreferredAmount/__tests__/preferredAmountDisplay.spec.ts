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
import { isFiatCurrency, precisionFor } from '../preferredAmountDisplay'

describe('isFiatCurrency', () => {
    it('treats a missing asset id as fiat', () => {
        expect(isFiatCurrency(null)).toBe(true)
    })

    it('treats an asset id as the ALGO currency', () => {
        expect(isFiatCurrency('0')).toBe(false)
    })
})

describe('precisionFor', () => {
    it('maps the compact density to compact precision', () => {
        expect(precisionFor('compact')).toBe('compact')
    })

    it('maps the detailed density to the preferred full precision', () => {
        expect(precisionFor('detailed')).toBe('preferredFull')
    })
})

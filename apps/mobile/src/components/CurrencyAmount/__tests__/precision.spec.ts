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

// @vitest-environment node

import { describe, it, expect } from 'vitest'
import { resolvePrecision } from '../precision'

// Literal digit counts (not symbol-relative) so these assertions actually pin
// the policy: DEFAULT_PRECISION = 2, PREFERRED_MAX_PRECISION = 6. Asserting
// against the mocked symbol would pass under any value and verify nothing.
describe('resolvePrecision', () => {
    it('noDecimal → 0 dp for whole-unit counts', () => {
        expect(resolvePrecision('noDecimal')).toEqual({
            precision: 0,
            minPrecision: 0,
        })
    })

    it('compact → fixed 2 dp for lists and summary totals', () => {
        expect(resolvePrecision('compact')).toEqual({
            precision: 2,
            minPrecision: 2,
        })
    })

    it('preferredFull → up to 6 dp, trimming trailing zeros down to 2', () => {
        expect(resolvePrecision('preferredFull')).toEqual({
            precision: 6,
            minPrecision: 2,
        })
    })

    it('assetFull → up to the asset decimals, flooring minPrecision at 2', () => {
        expect(resolvePrecision('assetFull', 6)).toEqual({
            precision: 6,
            minPrecision: 2,
        })
    })

    it('assetFull → floors both at the asset decimals for sub-2-decimal assets', () => {
        expect(resolvePrecision('assetFull', 1)).toEqual({
            precision: 1,
            minPrecision: 1,
        })
    })

    it('assetFull → 0 dp for 0-decimal collectibles', () => {
        expect(resolvePrecision('assetFull', 0)).toEqual({
            precision: 0,
            minPrecision: 0,
        })
    })

    it('assetFull → falls back to 2 dp when decimals are unknown', () => {
        expect(resolvePrecision('assetFull')).toEqual({
            precision: 2,
            minPrecision: 2,
        })
    })
})

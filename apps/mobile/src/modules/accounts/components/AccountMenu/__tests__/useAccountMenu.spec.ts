/*
 Copyright 2022-2025 Pera Wallet, LDA
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
import { resolveChartCollapsed } from '../useAccountMenu'

describe('resolveChartCollapsed', () => {
    it('collapses once scrolled past the collapse offset', () => {
        expect(resolveChartCollapsed(false, 49)).toBe(true)
    })

    it('stays expanded for small scrolls within the threshold', () => {
        expect(resolveChartCollapsed(false, 48)).toBe(false)
        expect(resolveChartCollapsed(false, 10)).toBe(false)
    })

    it('stays collapsed while scrolling within the hysteresis band', () => {
        // Already collapsed and still scrolled down past the expand offset.
        expect(resolveChartCollapsed(true, 40)).toBe(true)
        expect(resolveChartCollapsed(true, 8)).toBe(true)
    })

    it('re-expands only once scrolled back near the top', () => {
        expect(resolveChartCollapsed(true, 7)).toBe(false)
        expect(resolveChartCollapsed(true, 0)).toBe(false)
    })
})

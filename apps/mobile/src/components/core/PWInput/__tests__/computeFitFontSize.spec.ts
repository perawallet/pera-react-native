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

import { describe, expect, it } from 'vitest'
import { computeFitFontSize } from '../computeFitFontSize'

const base = { baseFontSize: 32, minFontScale: 0.5 }

describe('computeFitFontSize', () => {
    it('keeps the base size while the text fits the available width', () => {
        expect(
            computeFitFontSize({ text: '1.5', availableWidth: 300, ...base }),
        ).toBe(32)
    })

    it('returns the base size before the input has been measured', () => {
        expect(
            computeFitFontSize({
                text: '123456789',
                availableWidth: 0,
                ...base,
            }),
        ).toBe(32)
    })

    it('returns the base size for empty text', () => {
        expect(
            computeFitFontSize({ text: '', availableWidth: 100, ...base }),
        ).toBe(32)
    })

    it('scales the font down when the text would overflow', () => {
        const fontSize = computeFitFontSize({
            text: '123456789012345',
            availableWidth: 150,
            ...base,
        })
        expect(fontSize).toBeLessThan(32)
        expect(fontSize).toBeGreaterThanOrEqual(16)
    })

    it('never shrinks past the minimum font scale', () => {
        const fontSize = computeFitFontSize({
            text: '1'.repeat(100),
            availableWidth: 120,
            ...base,
        })
        expect(fontSize).toBe(16)
    })
})

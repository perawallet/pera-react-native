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
import { isTruncated, isWiderThanParent } from '../detectOverflow'

describe('isTruncated', () => {
    it('is false when numberOfLines is unset, since nothing can clip', () => {
        expect(isTruncated([{ text: 'Overview', width: 80 }], undefined)).toBe(
            false,
        )
    })

    it('is false when the text fits within numberOfLines with no ellipsis', () => {
        expect(isTruncated([{ text: 'Send', width: 40 }], 1)).toBe(false)
    })

    it('flags a tab label that truncates on a single allowed line (Discover/Receive case)', () => {
        // A tail-ellipsized single-line label: native layout still reports
        // exactly one line (capped by numberOfLines), so the tell is the
        // ellipsis glyph baked into that line's own text, not the line count.
        expect(isTruncated([{ text: 'Óṽéŕṽ…', width: 90 }], 1)).toBe(true)
    })

    it('flags a pill that wraps to two lines and still ellipsizes (Overview tab case)', () => {
        expect(
            isTruncated(
                [
                    { text: 'Óṽéŕ', width: 60 },
                    { text: 'ṽíéŵ…', width: 90 },
                ],
                2,
            ),
        ).toBe(true)
    })

    it('flags a platform that reports the natural line count uncapped', () => {
        expect(
            isTruncated(
                [
                    { text: 'line one', width: 100 },
                    { text: 'line two', width: 100 },
                    { text: 'line three', width: 100 },
                ],
                2,
            ),
        ).toBe(true)
    })
})

describe('isWiderThanParent', () => {
    it('is false until both measurements have arrived', () => {
        expect(isWiderThanParent(null, 100)).toBe(false)
        expect(isWiderThanParent(120, null)).toBe(false)
    })

    it('is false when the line fits within the box, allowing for float rounding', () => {
        expect(isWiderThanParent(100, 100.4)).toBe(false)
    })

    it('is true when a line is measurably wider than the box it was laid out in', () => {
        expect(isWiderThanParent(140, 100)).toBe(true)
    })
})

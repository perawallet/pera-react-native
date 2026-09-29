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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Dimensions, Platform } from 'react-native'
import { moderateScale, scaleLineHeight } from '../scaling'

describe('moderateScale', () => {
    beforeEach(() => {
        vi.mocked(Dimensions.get).mockReturnValue({
            width: 375,
            height: 812,
            scale: 2,
            fontScale: 1,
        })
    })

    it('returns the size unchanged at the base width (375)', () => {
        expect(moderateScale(20)).toBe(20)
    })

    it('floors at 1.0x for narrow devices (no down-scaling)', () => {
        vi.mocked(Dimensions.get).mockReturnValue({
            width: 320,
            height: 568,
            scale: 2,
            fontScale: 1,
        })
        expect(moderateScale(20)).toBe(20)
    })

    it('caps at 1.35x for wide devices (tablet)', () => {
        vi.mocked(Dimensions.get).mockReturnValue({
            width: 1024,
            height: 1366,
            scale: 2,
            fontScale: 1,
        })
        expect(moderateScale(20)).toBe(27) // 20 * 1.35
    })

    it('scales gently for large phones between the bounds', () => {
        // width 430 -> ratio = 1 + (430/375 - 1) * 0.5 = 1.07333...
        vi.mocked(Dimensions.get).mockReturnValue({
            width: 430,
            height: 932,
            scale: 3,
            fontScale: 1,
        })
        expect(moderateScale(20)).toBeCloseTo(21.4667, 3)
    })
})

describe('scaleLineHeight', () => {
    // The style value is pre-divided by the platform's native multiplier;
    // asserting the RENDERED box (style value × native multiplier) keeps the
    // tests readable. iOS multiplies by the clamped scale, Android by the
    // raw font scale.
    const renderedOnIos = (
        styleValue: number | undefined,
        fontScale: number,
        max = 1.5,
    ) => (styleValue ?? NaN) * Math.min(fontScale, max)
    const renderedOnAndroid = (
        styleValue: number | undefined,
        fontScale: number,
    ) => (styleValue ?? NaN) * fontScale

    it('returns the line height unchanged at font scale 1', () => {
        expect(scaleLineHeight(24, 13, 1, 1.5)).toBe(24)
    })

    it('renders scaled glyphs with constant leading on iOS', () => {
        Platform.OS = 'ios'
        // rendered box: 13 * 1.3 + leading 11
        expect(
            renderedOnIos(scaleLineHeight(24, 13, 1.3, 1.5), 1.3),
        ).toBeCloseTo(27.9, 5)
    })

    it('compensates for the unclamped native scaling on Android', () => {
        Platform.OS = 'android'
        // native multiplies by the raw 1.7 while glyphs cap at 1.5:
        // rendered box must still be 13 * 1.5 + 11 = 30.5
        expect(
            renderedOnAndroid(scaleLineHeight(24, 13, 1.7, 1.5), 1.7),
        ).toBeCloseTo(30.5, 5)
        Platform.OS = 'ios'
    })

    it('clamps the glyph growth at the max multiplier', () => {
        Platform.OS = 'ios'
        expect(
            renderedOnIos(scaleLineHeight(24, 13, 3.1, 1.5), 3.1),
        ).toBeCloseTo(30.5, 5) // 13 * 1.5 + 11
    })

    it('never shrinks the glyph box below the scaled font size', () => {
        Platform.OS = 'ios'
        // lineHeight below fontSize -> leading treated as 0
        expect(renderedOnIos(scaleLineHeight(12, 16, 1.5, 1.5), 1.5)).toBe(24)
    })

    it('scales the whole box once without a font size', () => {
        Platform.OS = 'ios'
        expect(
            renderedOnIos(scaleLineHeight(24, undefined, 1.3, 1.5), 1.3),
        ).toBeCloseTo(31.2, 5)
    })

    it('leaves an undefined line height untouched', () => {
        expect(scaleLineHeight(undefined, 13, 2, 1.5)).toBeUndefined()
    })
})

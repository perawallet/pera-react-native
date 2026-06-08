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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Dimensions } from 'react-native'
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
    it('returns the line height unchanged at font scale 1', () => {
        expect(scaleLineHeight(24, 1, 1.5)).toBe(24)
    })

    it('scales the line height by the font scale', () => {
        expect(scaleLineHeight(24, 1.3, 1.5)).toBeCloseTo(31.2, 5)
    })

    it('clamps the font scale at the max multiplier', () => {
        expect(scaleLineHeight(24, 3.1, 1.5)).toBe(36) // 24 * 1.5
    })

    it('leaves an undefined line height untouched', () => {
        expect(scaleLineHeight(undefined, 2, 1.5)).toBeUndefined()
    })
})

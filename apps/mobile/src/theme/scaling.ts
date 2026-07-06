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

import { Dimensions, Platform } from 'react-native'

const BASE_WIDTH = 375
const MIN_SCALE = 1
const MAX_SCALE = 1.35
const DEFAULT_FACTOR = 0.5

// Width-based moderate scale for typography (Issue 1: large form factors).
// Reads window width at call time; orientation is portrait-locked so width is
// stable per device. Clamped to [1, 1.35]: small phones are never shrunk,
// tablets are capped so text doesn't balloon.
export const moderateScale = (
    size: number,
    factor = DEFAULT_FACTOR,
): number => {
    const { width } = Dimensions.get('window')
    const ratio = 1 + (width / BASE_WIDTH - 1) * factor
    const clamped = Math.min(Math.max(ratio, MIN_SCALE), MAX_SCALE)
    return size * clamped
}

// RN's native text stack already multiplies an explicit `lineHeight` by the
// OS font scale — iOS clamps that at maxFontSizeMultiplier, Android applies
// the raw scale (sp conversion, no clamp). Pre-dividing by that native
// multiplier lets us pick the rendered line box exactly:
// `fontSize × clampedScale + leading`, so glyphs grow with accessibility
// font sizes while the design's leading (lineHeight − fontSize) stays
// constant — scaling the whole box would multiply the leading too,
// ballooning vertical rhythm in rows and multi-line titles (Issue 2).
export const scaleLineHeight = (
    lineHeight: number | undefined,
    fontSize: number | undefined,
    fontScale: number,
    maxMultiplier: number,
): number | undefined => {
    if (lineHeight === undefined) return undefined
    if (fontScale <= 0 || fontScale === 1) return lineHeight
    const clampedScale = Math.min(fontScale, maxMultiplier)
    const nativeMultiplier =
        Platform.OS === 'android' ? fontScale : clampedScale
    if (fontSize === undefined || fontSize <= 0) {
        // No font size to anchor the leading on: keep the whole-box scaling
        // but neutralize the native multiplication so it applies once.
        return (lineHeight * clampedScale) / nativeMultiplier
    }
    const leading = Math.max(lineHeight - fontSize, 0)
    return (fontSize * clampedScale + leading) / nativeMultiplier
}

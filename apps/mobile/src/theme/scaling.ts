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

import { Dimensions } from 'react-native'

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

// RN scales fontSize by the OS font scale but NOT an explicit lineHeight, so
// accessibility-scaled text clips (Issue 2). Scale the line box by the same
// factor. fontScale is clamped to maxMultiplier because maxFontSizeMultiplier
// caps the rendered font there while the OS keeps reporting the raw scale.
export const scaleLineHeight = (
    lineHeight: number | undefined,
    fontScale: number,
    maxMultiplier: number,
): number | undefined =>
    lineHeight === undefined
        ? undefined
        : lineHeight * Math.min(fontScale, maxMultiplier)

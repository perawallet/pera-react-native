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

// Approximate advance width of an average glyph as a fraction of the font
// size. Used to estimate rendered text width without measuring the glyphs —
// good enough to emulate `adjustsFontSizeToFit`, which React Native only
// honours on <Text>, never on the <TextInput> behind PWInput.
const CHAR_WIDTH_RATIO = 0.6

type ComputeFitFontSizeParams = {
    /** Current text whose width must fit `availableWidth`. */
    text: string
    /** Measured width available to the text; 0 until the input is laid out. */
    availableWidth: number
    /** The unshrunk font size for the input's variant. */
    baseFontSize: number
    /** Lower bound as a fraction of `baseFontSize` (e.g. 0.5). */
    minFontScale: number
}

// Shrinks the font so `text` stays on one line within `availableWidth`,
// mirroring `adjustsFontSizeToFit`. Returns `baseFontSize` until the input is
// measured or while the text fits, and never drops below
// `baseFontSize * minFontScale`.
export const computeFitFontSize = ({
    text,
    availableWidth,
    baseFontSize,
    minFontScale,
}: ComputeFitFontSizeParams): number => {
    if (availableWidth <= 0 || text.length === 0) return baseFontSize
    const estimatedWidth = text.length * baseFontSize * CHAR_WIDTH_RATIO
    if (estimatedWidth <= availableWidth) return baseFontSize
    const scaled = availableWidth / (text.length * CHAR_WIDTH_RATIO)
    return Math.max(baseFontSize * minFontScale, scaled)
}

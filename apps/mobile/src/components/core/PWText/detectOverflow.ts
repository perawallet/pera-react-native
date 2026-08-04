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

// Pulled out of PWText so the decision logic can be unit-tested against
// fixture data: react-native-web (this repo's unit test renderer) never
// calls onTextLayout at all, so a render-based test can't exercise it.

export type OverflowLine = { text: string; width: number }

// Rendered ellipsis glyphs across platforms/fonts: U+2026 (…) plus the
// three-dot fallback some Android renderers substitute for it. `$`-anchored,
// so this only ever matches ellipsizeMode 'tail' (the glyph trails the kept
// text); 'middle'/'head'/'clip' place or omit the glyph elsewhere on the
// line and can never match here.
const ELLIPSIS_PATTERN = /(…|\.\.\.)$/

// Once numberOfLines caps rendering, native layout engines report at most
// that many lines back, so "more lines than allowed" essentially never
// fires on its own. The reliable tell is a trailing ellipsis on the last
// visible line, but that detail is exactly the part onTextLayout reports
// inconsistently across iOS/Android, so both checks run rather than
// picking one — a false positive here only means reviewing one extra
// screenshot that turns out fine.
export const isTruncated = (
    lines: readonly OverflowLine[],
    numberOfLines: number | undefined,
): boolean => {
    if (numberOfLines === undefined || lines.length === 0) return false
    const lastLine = lines[lines.length - 1]
    return (
        lines.length > numberOfLines ||
        ELLIPSIS_PATTERN.test(lastLine.text.trimEnd())
    )
}

export const isWiderThanParent = (
    maxLineWidth: number | null,
    boxWidth: number | null,
): boolean => {
    if (maxLineWidth === null || boxWidth === null) return false
    // 1px tolerance for float rounding between the layout and text-layout events.
    return maxLineWidth > boxWidth + 1
}

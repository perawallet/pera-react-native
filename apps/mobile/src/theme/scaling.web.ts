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

// Web sibling of scaling.ts: moderateScale exists to grow type on large
// PHONES (375pt baseline, clamp [1, 1.35]). A desktop browser tab is not a
// large phone — the expanded surface (≥1280px) pins the 1.35 ceiling and
// renders all text 35% oversized. On web the design's px values apply as-is.
// scaleLineHeight: browsers don't multiply an explicit lineHeight by an OS
// font scale (that's the RN native text stack), so the design's line box
// applies unchanged too.
export const moderateScale = (size: number, _factor?: number): number => size

export const scaleLineHeight = (
    lineHeight: number | undefined,
    _fontSize: number | undefined,
    _fontScale: number,
    _maxMultiplier: number,
): number | undefined => lineHeight

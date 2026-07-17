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
import {
    moderateScale as nativeModerateScale,
    scaleLineHeight as nativeScaleLineHeight,
} from '../scaling'
import { moderateScale, scaleLineHeight } from '../scaling.web'

describe('scaling.web', () => {
    it('moderateScale returns the size unchanged regardless of factor', () => {
        expect(moderateScale(20)).toBe(20)
        expect(moderateScale(32, 0.5)).toBe(32)
        expect(moderateScale(0)).toBe(0)
    })

    it('scaleLineHeight returns the line height unchanged regardless of font scale', () => {
        expect(scaleLineHeight(24, 13, 1, 1.5)).toBe(24)
        expect(scaleLineHeight(40, 32, 1.7, 1.5)).toBe(40)
    })

    it('scaleLineHeight passes through undefined', () => {
        expect(scaleLineHeight(undefined, 13, 2, 1.5)).toBeUndefined()
    })

    it('does not mutate the native module (native scaling still balloons on wide widths)', () => {
        // Regression guard for the defect this file fixes: importing the web
        // override must not change what apps/mobile/src/theme/scaling.ts
        // (the native module) does. The two are separate platform files —
        // the bundler picks one per platform, not both at runtime — so this
        // just proves the native file is untouched by scaling.web.ts existing.
        expect(nativeModerateScale).not.toBe(moderateScale)
        expect(nativeScaleLineHeight).not.toBe(scaleLineHeight)
    })
})

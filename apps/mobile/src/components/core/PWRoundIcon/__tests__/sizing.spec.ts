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

import { describe, it, expect } from 'vitest'
import type { Theme } from '@rneui/themed'
import { getRoundIconDimensions } from '../sizing'

// Minimal theme stub: getRoundIconDimensions only reads theme.spacing.
const theme = {
    spacing: {
        xxs: 2,
        xs: 4,
        sm: 8,
        md: 12,
        lg: 16,
        xl: 24,
        xxl: 36,
        '3xl': 48,
        '4xl': 72,
        '5xl': 96,
    },
} as unknown as Theme

describe('getRoundIconDimensions', () => {
    it('sm = 16px glyph + 4px padding = 24px circle', () => {
        const d = getRoundIconDimensions(theme, 'sm')
        expect(d).toEqual({ diameter: 24, iconSize: 'sm', padding: 4 })
    })

    it('md = 24px glyph + 8px padding = 40px circle', () => {
        const d = getRoundIconDimensions(theme, 'md')
        expect(d).toEqual({ diameter: 40, iconSize: 'md', padding: 8 })
    })

    it('lg = 24px glyph + 24px padding = 72px circle', () => {
        const d = getRoundIconDimensions(theme, 'lg')
        expect(d).toEqual({ diameter: 72, iconSize: 'md', padding: 24 })
    })

    it('xl = 48px glyph + 16px padding = 80px circle', () => {
        const d = getRoundIconDimensions(theme, 'xl')
        expect(d).toEqual({ diameter: 80, iconSize: 'xl', padding: 16 })
    })
})

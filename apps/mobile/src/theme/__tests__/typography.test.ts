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

import { describe, it, expect } from 'vitest'
import { Theme } from '@rneui/themed'
import { getTypography, TypographyVariant } from '../typography'
import { getTheme } from '../theme'

describe('typography', () => {
    const lightTheme = getTheme('light') as Theme
    const darkTheme = getTheme('dark') as Theme

    describe('getTypography', () => {
        const variants: TypographyVariant[] = [
            'h1',
            'h2',
            'h3',
            'h4',
            'body',
            'caption',
            'link',
        ]

        it.each(variants)(
            'returns typography styles for %s variant',
            variant => {
                const result = getTypography(lightTheme, variant)

                expect(result).toHaveProperty('fontFamily')
                expect(result).toHaveProperty('fontSize')
                expect(result).toHaveProperty('color')
            },
        )

        it('returns correct font sizes for each heading variant', () => {
            expect(getTypography(lightTheme, 'h1').fontSize).toBe(32)
            expect(getTypography(lightTheme, 'h2').fontSize).toBe(25)
            expect(getTypography(lightTheme, 'h3').fontSize).toBe(19)
            expect(getTypography(lightTheme, 'h4').fontSize).toBe(15)
        })

        it('returns correct font size for body typography', () => {
            expect(getTypography(lightTheme, 'body').fontSize).toBe(13)
        })

        it('returns correct font size for caption typography', () => {
            expect(getTypography(lightTheme, 'caption').fontSize).toBe(11)
        })

        it('returns textMain color for body variant in light mode', () => {
            const result = getTypography(lightTheme, 'body')
            expect(result.color).toBe(lightTheme.colors.textMain)
        })

        it('returns textMain color for body variant in dark mode', () => {
            const result = getTypography(darkTheme, 'body')
            expect(result.color).toBe(darkTheme.colors.textMain)
        })

        it('returns linkPrimary color for link variant', () => {
            const result = getTypography(lightTheme, 'link')
            expect(result.color).toBe(lightTheme.colors.linkPrimary)
        })

        it('includes lineHeight for heading variants', () => {
            expect(getTypography(lightTheme, 'h1').lineHeight).toBe(40)
            expect(getTypography(lightTheme, 'h2').lineHeight).toBe(24)
            expect(getTypography(lightTheme, 'h3').lineHeight).toBe(24)
            expect(getTypography(lightTheme, 'h4').lineHeight).toBe(24)
        })
    })
})

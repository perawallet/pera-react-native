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
import {
    getTypography,
    getVariantFontWeight,
    type FontWeight,
    type TypographyVariant,
} from '../typography'
import { getTheme } from '../theme'
import { fontFamilies } from '@constants/fonts'

const ALL_VARIANTS: TypographyVariant[] = [
    'h1',
    'h2',
    'h3',
    'h4',
    'body',
    'bodyLarge',
    'bodyCompact',
    'bodySemibold',
    'footnoteMedium',
    'caption',
    'captionMedium',
    'captionSmall',
    'link',
    'linkPositive',
    'mono',
]

const FONT_FAMILY_TO_WEIGHT = new Map<string, FontWeight>([
    ...Object.entries(fontFamilies.DMSANS).map(
        ([weight, family]) => [family, Number(weight) as FontWeight] as const,
    ),
    ...Object.entries(fontFamilies.DMMONO).map(
        ([weight, family]) => [family, Number(weight) as FontWeight] as const,
    ),
])

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
            'bodyCompact',
            'bodySemibold',
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

        it('returns font sizes in descending order across heading hierarchy', () => {
            const h1 = getTypography(lightTheme, 'h1').fontSize!
            const h2 = getTypography(lightTheme, 'h2').fontSize!
            const h3 = getTypography(lightTheme, 'h3').fontSize!
            const h4 = getTypography(lightTheme, 'h4').fontSize!
            const body = getTypography(lightTheme, 'body').fontSize!
            const caption = getTypography(lightTheme, 'caption').fontSize!

            expect(h1).toBeGreaterThan(h2)
            expect(h2).toBeGreaterThan(h3)
            expect(h3).toBeGreaterThan(h4)
            expect(h4).toBeGreaterThan(body)
            expect(body).toBeGreaterThan(caption)
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

        it('has lineHeight greater than or equal to fontSize for all variants to prevent clipping', () => {
            const headings: TypographyVariant[] = [
                'h1',
                'h2',
                'h3',
                'h4',
                'body',
                'bodyCompact',
                'bodySemibold',
                'caption',
                'link',
            ]

            for (const variant of headings) {
                const style = getTypography(lightTheme, variant)
                expect(style.lineHeight).toBeGreaterThanOrEqual(style.fontSize!)
            }
        })
    })

    describe('getVariantFontWeight', () => {
        it.each(ALL_VARIANTS)(
            'stays consistent with the weight getTypography encodes for %s',
            variant => {
                const { fontFamily } = getTypography(lightTheme, variant)
                const encodedWeight = FONT_FAMILY_TO_WEIGHT.get(fontFamily!)

                expect(encodedWeight).toBeDefined()
                expect(getVariantFontWeight(variant)).toBe(encodedWeight)
            },
        )

        it('returns the medium weight for h1', () => {
            expect(getVariantFontWeight('h1')).toBe(500)
        })

        it('returns the semibold weight for h4', () => {
            expect(getVariantFontWeight('h4')).toBe(600)
        })

        it('returns the regular weight for body', () => {
            expect(getVariantFontWeight('body')).toBe(400)
        })
    })
})

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

import { describe, expect, it } from 'vitest'
import { accentPalette, palette, tints } from '../colors'
import { darkColorTokens } from '../tokens/dark'
import { lightColorTokens } from '../tokens/light'

const COLOR_PATTERN =
    /^(#[0-9A-Fa-f]{6}|rgba\(\s*\d{1,3},\s*\d{1,3},\s*\d{1,3},\s*(0|1|0?\.\d+)\s*\))$/

const hexToRgb = (hex: string): number[] => [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
]

const resolveTintBase = (base: string): string | undefined => {
    const colours: Record<string, string | Record<string, string>> = {
        ...palette,
        ...accentPalette,
    }
    const [, name, shade] = base.match(/^([a-z]+?)(\d*)$/i) ?? []
    const entry = colours[name]
    return typeof entry === 'string' ? entry : entry?.[shade]
}

describe('colour tokens', () => {
    it('defines the same tokens in the same order for light and dark', () => {
        expect(Object.keys(darkColorTokens)).toEqual(
            Object.keys(lightColorTokens),
        )
    })

    it.each([
        'chartAreaFill',
        'bannerCloseButtonBg',
        'qrCodeBg',
        'qrCodeFg',
        'bootsplashContent',
    ] as const)('%s is the same in light and dark', token => {
        expect(darkColorTokens[token]).toBe(lightColorTokens[token])
    })

    it('chartAreaFill is a 6-digit hex, since the native chart appends its own alpha', () => {
        expect(lightColorTokens.chartAreaFill).toMatch(/^#[0-9A-F]{6}$/i)
    })

    it('uses only hex or rgba colour strings', () => {
        const values = [
            ...Object.values(lightColorTokens),
            ...Object.values(darkColorTokens),
        ]

        const invalid = values.filter(value => !COLOR_PATTERN.test(value))

        expect(invalid).toEqual([])
    })
})

const relativeLuminance = (hex: string): number => {
    const [r, g, b] = hexToRgb(hex).map(channel => {
        const value = channel / 255
        return value <= 0.03928
            ? value / 12.92
            : ((value + 0.055) / 1.055) ** 2.4
    })
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

const contrastRatio = (foreground: string, background: string): number => {
    const [lighter, darker] = [
        relativeLuminance(foreground),
        relativeLuminance(background),
    ].sort((a, b) => b - a)
    return (lighter + 0.05) / (darker + 0.05)
}

type TokenName = keyof typeof lightColorTokens

const WCAG_AA_TEXT = 4.5
const WCAG_AA_NON_TEXT = 3

describe('contrast', () => {
    const modes = [
        ['light', lightColorTokens],
        ['dark', darkColorTokens],
    ] as const

    describe.each(modes)('%s mode', (_mode, tokens) => {
        it.each<[TokenName, TokenName]>([
            ['textGray', 'background'],
            ['textGray', 'layerGrayLighter'],
            ['linkPrimary', 'background'],
            ['positive', 'background'],
            ['warningText', 'background'],
        ])('%s on %s meets AA for text', (foreground, background) => {
            expect(
                contrastRatio(tokens[foreground], tokens[background]),
            ).toBeGreaterThanOrEqual(WCAG_AA_TEXT)
        })

        it('tabBarIconNonActive on background meets AA for icons', () => {
            expect(
                contrastRatio(tokens.tabBarIconNonActive, tokens.background),
            ).toBeGreaterThanOrEqual(WCAG_AA_NON_TEXT)
        })

        it('the checkbox and radio outline (textGray) on background meets AA for controls', () => {
            expect(
                contrastRatio(tokens.textGray, tokens.background),
            ).toBeGreaterThanOrEqual(WCAG_AA_NON_TEXT)
        })
    })

    it('positive on positiveLighter meets AA for text in light mode', () => {
        expect(
            contrastRatio(
                lightColorTokens.positive,
                lightColorTokens.positiveLighter,
            ),
        ).toBeGreaterThanOrEqual(WCAG_AA_TEXT)
    })

    it('the destructive label meets AA on alertNegative in dark mode', () => {
        expect(
            contrastRatio(
                darkColorTokens.alertContent,
                darkColorTokens.alertNegative,
            ),
        ).toBeGreaterThanOrEqual(WCAG_AA_TEXT)
    })

    it('dark mode gives layerGrayLightest its own surface step', () => {
        expect(darkColorTokens.layerGrayLightest).not.toBe(
            darkColorTokens.layerGrayLighter,
        )
    })
})

describe('tints', () => {
    it.each(Object.entries(tints))(
        '%s is its named base colour at its named alpha',
        (name, value) => {
            const [, base, percent] = name.match(/^(\w+?)Alpha(\d+)$/) ?? []
            const baseHex = resolveTintBase(base) ?? ''

            const [r, g, b, a] = value
                .replace(/[rgba()\s]/g, '')
                .split(',')
                .map(Number)

            expect([r, g, b]).toEqual(hexToRgb(baseHex))
            expect(a).toBeCloseTo(Number(percent) / 100)
        },
    )
})

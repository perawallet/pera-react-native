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

    it('uses only hex or rgba colour strings', () => {
        const values = [
            ...Object.values(lightColorTokens),
            ...Object.values(darkColorTokens),
        ]

        const invalid = values.filter(value => !COLOR_PATTERN.test(value))

        expect(invalid).toEqual([])
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

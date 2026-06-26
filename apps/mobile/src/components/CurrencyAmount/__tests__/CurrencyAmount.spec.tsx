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

import { render } from '@test-utils/render'
import { describe, it, expect, vi } from 'vitest'
import { formatCurrency } from '@perawallet/wallet-core-shared'
import { CurrencyAmount, getAlgoSymbolWeight } from '../CurrencyAmount'
import { PREFERRED_MAX_PRECISION } from '../precision'
import { Decimal } from 'decimal.js'
import type { TypographyVariant } from '@theme/typography'

describe('CurrencyAmount', () => {
    it('renders formatted currency value', () => {
        const { container } = render(
            <CurrencyAmount
                value={new Decimal(100)}
                currency='USD'
                precision='compact'
            />,
        )
        // A real value renders formatted content, not the null placeholder.
        expect(container.textContent).not.toContain('---')
        expect(container.textContent?.length).toBeGreaterThan(0)
    })

    it('displays placeholder when value is null', () => {
        const { container } = render(
            <CurrencyAmount
                value={null}
                currency='USD'
                precision='compact'
            />,
        )
        expect(container.textContent).toContain('---')
    })

    it('applies prefix when provided', () => {
        const { container } = render(
            <CurrencyAmount
                value={new Decimal(100)}
                currency='USD'
                precision='compact'
                prefix='+'
            />,
        )
        expect(container.textContent).toContain('+')
    })

    it('renders the sign after the Algo glyph', () => {
        const { container } = render(
            <CurrencyAmount
                value={new Decimal('0.5')}
                currency='ALGO'
                precision='preferredFull'
                sign='-'
            />,
        )
        const text = container.textContent ?? ''
        // "¦ -0.5" — glyph, then sign.
        expect(text.indexOf('¦')).toBeLessThan(text.indexOf('-'))
    })

    it('renders the sign after the unit for an ASA (not before it)', () => {
        const { container } = render(
            <CurrencyAmount
                value={new Decimal(1000)}
                currency='HIPO'
                precision='compact'
                sign='+'
            />,
        )
        const text = container.textContent ?? ''
        // "HIPO +1000" — unit symbol precedes the sign, unlike a prefix.
        expect(text.indexOf('HIPO')).toBeLessThan(text.indexOf('+'))
    })

    it('renders the Algo symbol as a text glyph for ALGO', () => {
        const { container } = render(
            <CurrencyAmount
                value={new Decimal('0.001')}
                currency='ALGO'
                precision='preferredFull'
            />,
        )
        // U+00A6 is the Algo mark in the bundled DMSans font.
        expect(container.textContent).toContain('¦')
    })

    it('hands the formatter the asset decimals resolved from the assetFull variant', () => {
        vi.mocked(formatCurrency).mockClear()
        render(
            <CurrencyAmount
                value={new Decimal('8.817812345')}
                currency='USD'
                precision='assetFull'
                assetDecimals={6}
            />,
        )
        // formatCurrency(value, precision, currency, ..., minPrecision) — the
        // assetFull variant resolves precision to the asset's own decimals.
        expect(vi.mocked(formatCurrency).mock.calls[0][1]).toBe(6)
    })

    it('hands the formatter PREFERRED_MAX_PRECISION for the preferredFull variant', () => {
        vi.mocked(formatCurrency).mockClear()
        render(
            <CurrencyAmount
                value={new Decimal('8.817812345')}
                currency='USD'
                precision='preferredFull'
            />,
        )
        expect(vi.mocked(formatCurrency).mock.calls[0][1]).toBe(
            PREFERRED_MAX_PRECISION,
        )
    })
})

describe('getAlgoSymbolWeight', () => {
    // U+00A6 only carries the Algo logo in DMSans 400/500/700; weight 600
    // (h4/bodySemibold) and DMMono render the stock broken-bar glyph.
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

    it.each(ALL_VARIANTS)('never resolves %s to the unpatched 600', variant => {
        expect(getAlgoSymbolWeight(variant)).not.toBe(600)
    })

    it('bumps weight-600 variants to 700 so the logo glyph renders', () => {
        expect(getAlgoSymbolWeight('h4')).toBe(700)
        expect(getAlgoSymbolWeight('bodySemibold')).toBe(700)
    })

    it('leaves already-patched variant weights unchanged', () => {
        expect(getAlgoSymbolWeight('h1')).toBe(500)
        expect(getAlgoSymbolWeight('body')).toBe(400)
    })

    it('honours an explicit weight override, still clamping 600 to 700', () => {
        expect(getAlgoSymbolWeight('h4', 500)).toBe(500)
        expect(getAlgoSymbolWeight('body', 600)).toBe(700)
    })
})

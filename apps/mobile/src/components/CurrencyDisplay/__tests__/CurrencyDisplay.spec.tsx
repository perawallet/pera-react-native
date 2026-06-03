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
import { CurrencyDisplay, getAlgoSymbolWeight } from '../CurrencyDisplay'
import { Decimal } from 'decimal.js'
import type { TypographyVariant } from '@theme/typography'

describe('CurrencyDisplay', () => {
    it('renders formatted currency value', () => {
        const { container } = render(
            <CurrencyDisplay
                value={new Decimal(100)}
                currency='USD'
                precision={2}
            />,
        )
        expect(container).toBeTruthy()
    })

    it('displays placeholder when value is null', () => {
        const { container } = render(
            <CurrencyDisplay
                value={null}
                currency='USD'
                precision={2}
            />,
        )
        expect(container.textContent).toContain('---')
    })

    it('applies prefix when provided', () => {
        const { container } = render(
            <CurrencyDisplay
                value={new Decimal(100)}
                currency='USD'
                precision={2}
                prefix='+'
            />,
        )
        expect(container.textContent).toContain('+')
    })

    it('renders the Algo symbol as a text glyph for ALGO', () => {
        const { container } = render(
            <CurrencyDisplay
                value={new Decimal('0.001')}
                currency='ALGO'
                precision={6}
            />,
        )
        // U+00A6 is the Algo mark in the bundled DMSans font.
        expect(container.textContent).toContain('¦')
    })

    it('clamps the precision handed to the formatter to maxPrecision', () => {
        vi.mocked(formatCurrency).mockClear()
        render(
            <CurrencyDisplay
                value={new Decimal('8.817812345')}
                currency='USD'
                precision={6}
                maxPrecision={2}
            />,
        )
        // formatCurrency(value, precision, currency, ...) — precision is arg 1.
        expect(vi.mocked(formatCurrency).mock.calls[0][1]).toBe(2)
    })

    it('passes precision through unchanged when maxPrecision is omitted', () => {
        vi.mocked(formatCurrency).mockClear()
        render(
            <CurrencyDisplay
                value={new Decimal('8.817812345')}
                currency='USD'
                precision={6}
            />,
        )
        expect(vi.mocked(formatCurrency).mock.calls[0][1]).toBe(6)
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

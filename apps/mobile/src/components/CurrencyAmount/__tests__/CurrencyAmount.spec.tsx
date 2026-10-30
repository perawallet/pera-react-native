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

import { render, screen } from '@test-utils/render'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { formatCurrency } from '@perawallet/wallet-core-shared'
import { CurrencyAmount, getAlgoSymbolWeight } from '../CurrencyAmount'
import { PREFERRED_MAX_PRECISION } from '../precision'
import { Decimal } from 'decimal.js'
import { LEGACY_CHAIN_ID } from '@perawallet/wallet-core-chain-contract'
import { useSettings } from '@perawallet/wallet-core-settings'
import type { TypographyVariant } from '@theme/typography'
import { UNKNOWN_AMOUNT_PLACEHOLDER } from '@constants/ui'
import {
    registerEthereumChain,
    restoreAlgorandOnlyChains,
} from '@test-utils/chain-fixtures'

describe('CurrencyAmount', () => {
    it('renders formatted currency value', () => {
        const { container } = render(
            <CurrencyAmount
                value={new Decimal(100)}
                currency='USD'
                assetId={null}
                chainId={null}
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
                assetId={null}
                chainId={null}
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
                assetId={null}
                chainId={null}
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
                assetId='0'
                chainId={LEGACY_CHAIN_ID}
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
                assetId='123456'
                chainId={LEGACY_CHAIN_ID}
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
                assetId='0'
                chainId={LEGACY_CHAIN_ID}
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
                currency='USDC'
                assetId='31566704'
                chainId={LEGACY_CHAIN_ID}
                precision='assetFull'
                assetDecimals={6}
            />,
        )
        // formatCurrency(value, precision, currency, ..., minPrecision) — the
        // assetFull variant resolves precision to the asset's own decimals.
        expect(vi.mocked(formatCurrency).mock.calls[0][1]).toBe(6)
    })

    it('hands the formatter an 18-decimal amount already rounded down', () => {
        vi.mocked(formatCurrency).mockClear()
        render(
            <CurrencyAmount
                value={new Decimal('0.0013449999')}
                currency='ETH'
                assetId='eth'
                chainId={null}
                precision='assetFull'
                assetDecimals={18}
            />,
        )
        // The formatter rounds half-up, which would show 0.001345.
        const [value, precision] = vi.mocked(formatCurrency).mock.calls[0]
        expect(String(value)).toBe('0.001344')
        expect(precision).toBe(6)
    })

    it('hands the formatter PREFERRED_MAX_PRECISION for the preferredFull variant', () => {
        vi.mocked(formatCurrency).mockClear()
        render(
            <CurrencyAmount
                value={new Decimal('8.817812345')}
                currency='USD'
                assetId={null}
                chainId={null}
                precision='preferredFull'
            />,
        )
        expect(vi.mocked(formatCurrency).mock.calls[0][1]).toBe(
            PREFERRED_MAX_PRECISION,
        )
    })
})

describe('CurrencyAmount fiat floor', () => {
    it('shows a sub-cent fiat amount as "< " plus one cent in the given currency', () => {
        vi.mocked(formatCurrency).mockClear()
        const { container } = render(
            <CurrencyAmount
                value={new Decimal('0.004')}
                currency='EUR'
                assetId={null}
                chainId={null}
                isFiat
                precision='compact'
            />,
        )
        const [value, precision, currency, , showSymbol, , minPrecision] =
            vi.mocked(formatCurrency).mock.calls[0]
        expect(container.textContent).toMatch(/^< /)
        expect(value?.toString()).toBe('0.01')
        expect(precision).toBe(2)
        expect(minPrecision).toBe(2)
        expect(currency).toBe('EUR')
        expect(showSymbol).toBe(true)
    })

    it('formats the floor in the same locale as any other amount', () => {
        vi.mocked(formatCurrency).mockClear()
        render(
            <CurrencyAmount
                value={new Decimal('0.004')}
                currency='EUR'
                assetId={null}
                chainId={null}
                isFiat
                precision='compact'
            />,
        )
        const floorLocale = vi.mocked(formatCurrency).mock.calls[0][3]

        vi.mocked(formatCurrency).mockClear()
        render(
            <CurrencyAmount
                value={new Decimal('5')}
                currency='EUR'
                assetId={null}
                chainId={null}
                isFiat
                precision='compact'
            />,
        )
        expect(vi.mocked(formatCurrency).mock.calls[0][3]).toBe(floorLocale)
    })

    it('shows a negative sub-cent fiat amount as a lower bound, keeping its sign', () => {
        vi.mocked(formatCurrency).mockClear()
        const { container } = render(
            <CurrencyAmount
                value={new Decimal('-0.004')}
                currency='USD'
                assetId={null}
                chainId={null}
                isFiat
                precision='compact'
            />,
        )
        expect(container.textContent).toMatch(/^> /)
        expect(vi.mocked(formatCurrency).mock.calls[0][0]?.toString()).toBe(
            '-0.01',
        )
    })

    it('keeps a sub-cent token amount without an asset id on the crypto rule', () => {
        vi.mocked(formatCurrency).mockClear()
        const { container } = render(
            <CurrencyAmount
                value={new Decimal('0.004')}
                currency='ETH'
                assetId={null}
                chainId={null}
                precision='compact'
            />,
        )
        expect(container.textContent).not.toMatch(/[<>] /)
        expect(vi.mocked(formatCurrency).mock.calls[0][0]?.toString()).toBe(
            '0.004',
        )
        expect(vi.mocked(formatCurrency).mock.calls[0][1]).toBe(3)
    })

    it('rounds a larger fiat amount to 2 dp without the marker', () => {
        vi.mocked(formatCurrency).mockClear()
        const { container } = render(
            <CurrencyAmount
                value={new Decimal('0.025773')}
                currency='USD'
                assetId={null}
                chainId={null}
                isFiat
                precision='compact'
            />,
        )
        const call = vi.mocked(formatCurrency).mock.calls[0]
        expect(call[0]?.toString()).toBe('0.025773')
        expect(call[1]).toBe(2)
        expect(container.textContent).not.toContain('< ')
    })

    it('keeps a sub-cent ALGO amount on the crypto rule', () => {
        vi.mocked(formatCurrency).mockClear()
        const { container } = render(
            <CurrencyAmount
                value={new Decimal('0.004')}
                currency='ALGO'
                assetId='0'
                chainId={LEGACY_CHAIN_ID}
                precision='compact'
            />,
        )
        expect(container.textContent).not.toContain('< ')
        expect(vi.mocked(formatCurrency).mock.calls[0][1]).toBe(3)
    })

    it('leaves a sub-cent unit price at its detail precision', () => {
        const { container } = render(
            <CurrencyAmount
                value={new Decimal('0.000012')}
                currency='USD'
                assetId={null}
                chainId={null}
                isFiat
                precision='preferredFull'
            />,
        )
        expect(container.textContent).not.toContain('< ')
    })

    it('hides the amount, floor included, in privacy mode', () => {
        vi.mocked(useSettings).mockReturnValueOnce({
            privacyMode: true,
        } as ReturnType<typeof useSettings>)
        const { container } = render(
            <CurrencyAmount
                value={new Decimal('0.004')}
                currency='USD'
                assetId={null}
                chainId={null}
                isFiat
                precision='compact'
            />,
        )
        expect(container.textContent).toContain('****')
        expect(container.textContent).not.toContain('< ')
    })
})

// Identity spoofing: an ASA's unit name is free-form on chain, so an asset
// named "ALGO" or "USD" must never borrow the native glyph or a fiat symbol.
describe('CurrencyAmount identity comes from the asset id, not the unit name', () => {
    it("never renders the Algo glyph for an ASA whose unit name is 'ALGO'", () => {
        const { container } = render(
            <CurrencyAmount
                value={new Decimal(1000)}
                currency='ALGO'
                assetId='987654321'
                chainId={LEGACY_CHAIN_ID}
                precision='compact'
            />,
        )
        expect(container.textContent).not.toContain('¦')
        // The unit name still shows, as plain text.
        expect(container.textContent).toContain('ALGO')
    })

    it("never renders the Algo glyph at the end position for a spoofed 'ALGO' ASA", () => {
        const { container } = render(
            <CurrencyAmount
                value={new Decimal(1000)}
                currency='ALGO'
                assetId='987654321'
                chainId={LEGACY_CHAIN_ID}
                precision='compact'
                symbolPosition='end'
            />,
        )
        expect(container.textContent).not.toContain('¦')
    })

    it('never asks the formatter to map an asset unit name to a fiat symbol', () => {
        vi.mocked(formatCurrency).mockClear()
        render(
            <CurrencyAmount
                value={new Decimal(1000)}
                currency='USD'
                assetId='987654321'
                chainId={LEGACY_CHAIN_ID}
                precision='compact'
            />,
        )
        // formatCurrency's showSymbol arg is false for every asset amount, so
        // its USD → $ mapping is unreachable; the unit renders as plain text.
        expect(vi.mocked(formatCurrency).mock.calls[0][4]).toBe(false)
    })

    it('still lets a display-currency amount format with its fiat symbol', () => {
        vi.mocked(formatCurrency).mockClear()
        render(
            <CurrencyAmount
                value={new Decimal(1000)}
                currency='USD'
                assetId={null}
                chainId={null}
                precision='compact'
            />,
        )
        expect(vi.mocked(formatCurrency).mock.calls[0][4]).toBe(true)
    })

    it('does not render the glyph for an asset whose id is unknown', () => {
        const { container } = render(
            <CurrencyAmount
                value={new Decimal(1)}
                currency='ALGO'
                assetId=''
                chainId={LEGACY_CHAIN_ID}
                precision='compact'
            />,
        )
        expect(container.textContent).not.toContain('¦')
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

// RN-web renders a View as <div> and a Text as <span>, so "no div" means the
// inline amount is text runs only and can't escape a parent Text's truncation.
describe('CurrencyAmount isInline', () => {
    it('renders an ASA amount and unit as text only, with the same string as the default layout', () => {
        const props = {
            value: new Decimal('1234.5'),
            currency: 'USDC',
            assetId: '31566704',
            chainId: LEGACY_CHAIN_ID,
            precision: 'assetFull',
            assetDecimals: 6,
            symbolPosition: 'end',
        } as const
        const { container: blockContainer } = render(
            <CurrencyAmount {...props} />,
        )
        const { container } = render(
            <CurrencyAmount
                {...props}
                isInline
            />,
        )

        expect(container.querySelector('div')).toBeNull()
        expect(container.textContent).toBe(blockContainer.textContent)
    })

    it('renders the Algo glyph inline, spaced from the amount the default layout shows', () => {
        const props = {
            value: new Decimal('1234.5'),
            currency: 'ALGO',
            assetId: '0',
            chainId: LEGACY_CHAIN_ID,
            precision: 'assetFull',
            assetDecimals: 6,
        } as const
        const { container: blockContainer } = render(
            <CurrencyAmount {...props} />,
        )
        const { container } = render(
            <CurrencyAmount
                {...props}
                isInline
            />,
        )

        expect(container.querySelector('div')).toBeNull()
        expect(container.textContent).toBe(
            `¦ ${blockContainer.textContent?.replace('¦', '')}`,
        )
    })

    it('shows the placeholder as text instead of the skeleton while loading', () => {
        const { container } = render(
            <CurrencyAmount
                value={new Decimal(1)}
                currency='USDC'
                assetId='31566704'
                chainId={LEGACY_CHAIN_ID}
                precision='compact'
                isLoading
                isInline
            />,
        )

        expect(container.querySelector('div')).toBeNull()
        expect(container.textContent).toBe(UNKNOWN_AMOUNT_PLACEHOLDER)
    })
})

describe('CurrencyAmount native-coin glyph per chain', () => {
    beforeEach(() => {
        registerEthereumChain()
    })

    afterEach(() => {
        restoreAlgorandOnlyChains()
    })

    it('shows the unit for ETH native, with no Algo glyph', () => {
        const { container } = render(
            <CurrencyAmount
                value={new Decimal('0.5')}
                currency='ETH'
                assetId='native'
                chainId='ethereum'
                precision='preferredFull'
            />,
        )
        const text = container.textContent ?? ''
        expect(text).toContain('ETH')
        expect(text).not.toContain('¦')
    })

    it("treats Algorand's native id on an EVM chain as a token", () => {
        const { container } = render(
            <CurrencyAmount
                value={new Decimal('3')}
                currency='ZRO'
                assetId='0'
                chainId='ethereum'
                precision='preferredFull'
            />,
        )
        const text = container.textContent ?? ''
        expect(text).toContain('ZRO')
        expect(text).not.toContain('¦')
    })

    it('draws no glyph when the amount has no chain', () => {
        const { container } = render(
            <CurrencyAmount
                value={new Decimal('3')}
                currency='ZRO'
                assetId='0'
                chainId={null}
                precision='preferredFull'
            />,
        )
        expect(container.textContent).not.toContain('¦')
    })
})

describe('CurrencyAmount shouldFitWidth', () => {
    const props = {
        value: new Decimal('1234.5'),
        currency: 'ETH',
        assetId: 'eth',
        chainId: null,
        precision: 'assetFull',
        assetDecimals: 18,
    } as const

    it('keeps the unit in its own text by default', () => {
        render(<CurrencyAmount {...props} />)

        expect(screen.getByText('ETH')).toBeTruthy()
    })

    it('renders the unit and the figure as one text, so they shrink together', () => {
        const { container, unmount } = render(
            <CurrencyAmount
                {...props}
                shouldFitWidth
            />,
        )
        expect(screen.queryByText('ETH')).toBeNull()
        const fittedText = container.textContent?.replace(/\s/g, '')
        unmount()

        const { container: blockContainer } = render(
            <CurrencyAmount {...props} />,
        )
        expect(fittedText).toBe(blockContainer.textContent?.replace(/\s/g, ''))
    })
})

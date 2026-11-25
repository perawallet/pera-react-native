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

import { renderHook, act } from '@test-utils/render'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Decimal } from 'decimal.js'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import type { SwapQuote } from '@perawallet/wallet-core-swaps'
import { formatCurrency } from '@perawallet/wallet-core-shared'
import { useSwapAmountSection } from '../useSwapAmountSection'

const SCOPE: ChainScope = { chainId: 'algorand', networkId: 'mainnet' }

let mockAsset = {
    assetId: '0',
    name: 'Algorand',
    unitName: 'ALGO',
    decimals: 6,
    creator: { address: '' },
    totalSupply: new Decimal(10_000_000_000),
}

let mockPrices = new Map<string, { assetId: string; usdPrice: Decimal }>()
const mockUseAssetPricesQuery = vi.fn()

vi.mock('@perawallet/wallet-core-assets', () => ({
    PeraAssetVerificationTier: {
        verified: 'verified',
        suspicious: 'suspicious',
        unverified: 'unverified',
    },
    useAssetsQuery: () => ({
        data: new Map([['0', mockAsset]]),
    }),
    useAssetPricesQuery: (...args: unknown[]) => {
        mockUseAssetPricesQuery(...args)
        return { data: mockPrices }
    },
}))

// fiat × 2 = asset units; asset ÷ 2 = fiat.
const fiatToAsset = (fiat: Decimal | null) =>
    fiat ? fiat.mul(new Decimal(2)) : null
const assetToFiat = (asset: Decimal | null) =>
    asset ? asset.div(new Decimal(2)) : null

describe('useSwapAmountSection', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('returns isPay true for pay variant', () => {
        const { result } = renderHook(() =>
            useSwapAmountSection({
                scope: SCOPE,
                variant: 'pay',
                assetId: '0',
                amount: null,
                onAmountChange: vi.fn(),
            }),
        )

        expect(result.current.isPay).toBe(true)
    })

    it('returns isPay false for receive variant', () => {
        const { result } = renderHook(() =>
            useSwapAmountSection({
                scope: SCOPE,
                variant: 'receive',
                assetId: '0',
                amount: null,
            }),
        )

        expect(result.current.isPay).toBe(false)
    })

    it.each([
        ['resolved', '0', true],
        ['unresolved', '999', false],
    ])('shows the balance only for a %s asset', (_name, assetId, expected) => {
        const { result } = renderHook(() =>
            useSwapAmountSection({
                scope: SCOPE,
                variant: 'receive',
                assetId,
                amount: null,
            }),
        )

        expect(result.current.isBalanceShown).toBe(expected)
    })

    it('returns hasPositiveAmount false when amount is null', () => {
        const { result } = renderHook(() =>
            useSwapAmountSection({
                scope: SCOPE,
                variant: 'pay',
                assetId: '0',
                amount: null,
                onAmountChange: vi.fn(),
            }),
        )

        expect(result.current.hasPositiveAmount).toBe(false)
    })

    it('returns hasPositiveAmount true when amount is positive', () => {
        const { result } = renderHook(() =>
            useSwapAmountSection({
                scope: SCOPE,
                variant: 'pay',
                assetId: '0',
                amount: new Decimal(5),
                onAmountChange: vi.fn(),
            }),
        )

        expect(result.current.hasPositiveAmount).toBe(true)
    })

    it('returns hasPositiveAmount false when amount is zero', () => {
        const { result } = renderHook(() =>
            useSwapAmountSection({
                scope: SCOPE,
                variant: 'pay',
                assetId: '0',
                amount: new Decimal(0),
                onAmountChange: vi.fn(),
            }),
        )

        expect(result.current.hasPositiveAmount).toBe(false)
    })

    it('normalizes comma to dot in handleTextChange', () => {
        const onAmountChange = vi.fn()
        const { result } = renderHook(() =>
            useSwapAmountSection({
                scope: SCOPE,
                variant: 'pay',
                assetId: '0',
                amount: null,
                onAmountChange,
            }),
        )

        act(() => {
            result.current.handleTextChange('1,5')
        })

        expect(onAmountChange).toHaveBeenCalledWith(new Decimal('1.5'))
    })

    describe('decimal separator normalization', () => {
        it('drops European grouping separators from a pasted value', () => {
            const onAmountChange = vi.fn()
            const { result } = renderHook(() =>
                useSwapAmountSection({
                    scope: SCOPE,
                    variant: 'pay',
                    assetId: '0',
                    amount: null,
                    onAmountChange,
                }),
            )

            // "1.000,50" (de-DE) → 1000.5
            act(() => {
                result.current.handleTextChange('1.000,50')
            })

            expect(onAmountChange).toHaveBeenLastCalledWith(
                new Decimal('1000.5'),
            )
        })

        it('drops US grouping separators from a pasted value', () => {
            const onAmountChange = vi.fn()
            const { result } = renderHook(() =>
                useSwapAmountSection({
                    scope: SCOPE,
                    variant: 'pay',
                    assetId: '0',
                    amount: null,
                    onAmountChange,
                }),
            )

            // "1,000.50" (en-US) → 1000.5
            act(() => {
                result.current.handleTextChange('1,000.50')
            })

            expect(onAmountChange).toHaveBeenLastCalledWith(
                new Decimal('1000.5'),
            )
        })

        it('strips whitespace grouping separators (fr-FR style)', () => {
            const onAmountChange = vi.fn()
            const { result } = renderHook(() =>
                useSwapAmountSection({
                    scope: SCOPE,
                    variant: 'pay',
                    assetId: '0',
                    amount: null,
                    onAmountChange,
                }),
            )

            // "1 000,50" (fr-FR) → 1000.5
            act(() => {
                result.current.handleTextChange('1 000,50')
            })

            expect(onAmountChange).toHaveBeenLastCalledWith(
                new Decimal('1000.5'),
            )
        })

        it('treats the last separator as the decimal point with multiple commas', () => {
            const onAmountChange = vi.fn()
            const { result } = renderHook(() =>
                useSwapAmountSection({
                    scope: SCOPE,
                    variant: 'pay',
                    assetId: '0',
                    amount: null,
                    onAmountChange,
                }),
            )

            // Only the final comma is the decimal separator: "1,2,3" → 12.3
            act(() => {
                result.current.handleTextChange('1,2,3')
            })

            expect(onAmountChange).toHaveBeenLastCalledWith(new Decimal('12.3'))
        })

        it('normalizes and constrains a comma-decimal entry in fiat mode', () => {
            const onAmountChange = vi.fn()
            const { result } = renderHook(() =>
                useSwapAmountSection({
                    scope: SCOPE,
                    variant: 'pay',
                    assetId: '0',
                    amount: null,
                    onAmountChange,
                    isLocalCurrencyInput: true,
                    fiatToAsset,
                    assetToFiat,
                }),
            )

            // "12,3456" → "12.3456" → constrained to 2 dp "12.34" → ×2 = 24.68
            act(() => {
                result.current.handleTextChange('12,3456')
            })

            expect(result.current.displayValue).toBe('12.34')
            expect(onAmountChange).toHaveBeenLastCalledWith(
                new Decimal('24.68'),
            )
        })
    })

    it('calls onAmountChange with null for empty input', () => {
        const onAmountChange = vi.fn()
        const { result } = renderHook(() =>
            useSwapAmountSection({
                scope: SCOPE,
                variant: 'pay',
                assetId: '0',
                amount: new Decimal(5),
                onAmountChange,
            }),
        )

        act(() => {
            result.current.handleTextChange('')
        })

        expect(onAmountChange).toHaveBeenCalledWith(null)
    })

    it('calls onAmountChange with null for lone dot', () => {
        const onAmountChange = vi.fn()
        const { result } = renderHook(() =>
            useSwapAmountSection({
                scope: SCOPE,
                variant: 'pay',
                assetId: '0',
                amount: null,
                onAmountChange,
            }),
        )

        act(() => {
            result.current.handleTextChange('.')
        })

        expect(onAmountChange).toHaveBeenCalledWith(null)
    })

    it('ignores invalid text input without calling onAmountChange', () => {
        const onAmountChange = vi.fn()
        const { result } = renderHook(() =>
            useSwapAmountSection({
                scope: SCOPE,
                variant: 'pay',
                assetId: '0',
                amount: null,
                onAmountChange,
            }),
        )

        act(() => {
            result.current.handleTextChange('abc')
        })

        expect(onAmountChange).not.toHaveBeenCalled()
    })

    it('does not call onAmountChange in receive variant', () => {
        const onAmountChange = vi.fn()
        const { result } = renderHook(() =>
            useSwapAmountSection({
                scope: SCOPE,
                variant: 'receive',
                assetId: '0',
                amount: null,
                onAmountChange,
            }),
        )

        act(() => {
            result.current.handleTextChange('5')
        })

        expect(onAmountChange).not.toHaveBeenCalled()
    })

    it('returns empty displayValue for receive variant with null amount', () => {
        const { result } = renderHook(() =>
            useSwapAmountSection({
                scope: SCOPE,
                variant: 'receive',
                assetId: '0',
                amount: null,
            }),
        )

        expect(result.current.displayValue).toBe('')
    })

    it('returns formatted displayValue for receive variant with amount', () => {
        const { result } = renderHook(() =>
            useSwapAmountSection({
                scope: SCOPE,
                variant: 'receive',
                assetId: '0',
                amount: new Decimal('1234.56'),
            }),
        )

        // Should be formatted via formatCurrency, not raw toString
        expect(result.current.displayValue).not.toBe('')
        expect(result.current.displayValue).toBeDefined()
    })

    describe('local currency (fiat) input', () => {
        it('converts the typed fiat amount to asset units before handing it up', () => {
            const onAmountChange = vi.fn()
            const { result } = renderHook(() =>
                useSwapAmountSection({
                    scope: SCOPE,
                    variant: 'pay',
                    assetId: '0',
                    amount: null,
                    onAmountChange,
                    isLocalCurrencyInput: true,
                    fiatToAsset,
                    assetToFiat,
                }),
            )

            act(() => {
                result.current.handleTextChange('100')
            })

            // 100 fiat × 2 = 200 asset units
            expect(onAmountChange).toHaveBeenLastCalledWith(new Decimal(200))
            expect(result.current.isFiatInput).toBe(true)
        })

        it('constrains the fiat entry to two decimal places', () => {
            const onAmountChange = vi.fn()
            const { result } = renderHook(() =>
                useSwapAmountSection({
                    scope: SCOPE,
                    variant: 'pay',
                    assetId: '0',
                    amount: null,
                    onAmountChange,
                    isLocalCurrencyInput: true,
                    fiatToAsset,
                    assetToFiat,
                }),
            )

            act(() => {
                result.current.handleTextChange('1.234')
            })

            // trimmed to 1.23 → ×2 = 2.46
            expect(result.current.displayValue).toBe('1.23')
            expect(onAmountChange).toHaveBeenLastCalledWith(new Decimal('2.46'))
        })

        it('hands up null when the fiat field is cleared', () => {
            const onAmountChange = vi.fn()
            const { result } = renderHook(() =>
                useSwapAmountSection({
                    scope: SCOPE,
                    variant: 'pay',
                    assetId: '0',
                    amount: new Decimal(10),
                    onAmountChange,
                    isLocalCurrencyInput: true,
                    fiatToAsset,
                    assetToFiat,
                }),
            )

            act(() => {
                result.current.handleTextChange('')
            })

            expect(onAmountChange).toHaveBeenLastCalledWith(null)
        })

        it('displays the fiat equivalent of the asset amount when blurred', () => {
            const { result } = renderHook(() =>
                useSwapAmountSection({
                    scope: SCOPE,
                    variant: 'pay',
                    assetId: '0',
                    amount: new Decimal(200),
                    isLocalCurrencyInput: true,
                    fiatToAsset,
                    assetToFiat,
                }),
            )

            // 200 asset ÷ 2 = 100.00 fiat
            expect(result.current.displayValue).toBe('100.00')
        })

        it('preserves the typed fiat instead of a rounded round-trip value', () => {
            const lossyFiatToAsset = (f: Decimal | null) =>
                f
                    ? f
                          .div(new Decimal('0.21'))
                          .toDecimalPlaces(6, Decimal.ROUND_DOWN)
                    : null
            const lossyAssetToFiat = (a: Decimal | null) =>
                a
                    ? a
                          .mul(new Decimal('0.21'))
                          .toDecimalPlaces(2, Decimal.ROUND_DOWN)
                    : null

            const onAmountChange = vi.fn()
            const baseProps = {
                scope: SCOPE,
                variant: 'pay' as const,
                assetId: '0',
                onAmountChange,
                isLocalCurrencyInput: true,
                fiatToAsset: lossyFiatToAsset,
                assetToFiat: lossyAssetToFiat,
            }
            const { result, rerender } = renderHook(
                (props: Parameters<typeof useSwapAmountSection>[0]) =>
                    useSwapAmountSection(props),
                {
                    initialProps: {
                        ...baseProps,
                        amount: null as Decimal | null,
                    },
                },
            )

            act(() => {
                result.current.handleTextChange('3')
            })
            const emittedAsset = onAmountChange.mock.calls.at(
                -1,
            )?.[0] as Decimal

            rerender({ ...baseProps, amount: emittedAsset })

            expect(lossyAssetToFiat(emittedAsset)?.toString()).toBe('2.99')
            expect(result.current.displayValue).toBe('3')
        })

        it('reports isFiatInput false and keeps asset behavior when toggle off', () => {
            const onAmountChange = vi.fn()
            const { result } = renderHook(() =>
                useSwapAmountSection({
                    scope: SCOPE,
                    variant: 'pay',
                    assetId: '0',
                    amount: null,
                    onAmountChange,
                    isLocalCurrencyInput: false,
                }),
            )

            act(() => {
                result.current.handleTextChange('5')
            })

            expect(result.current.isFiatInput).toBe(false)
            expect(onAmountChange).toHaveBeenLastCalledWith(new Decimal(5))
        })
    })

    describe('rounding to the display rule', () => {
        const ERC20 = { ...mockAsset, unitName: 'SPCXx', decimals: 18 }
        const exact = new Decimal('0.0079852331615467')
        const payProps = {
            scope: SCOPE,
            variant: 'pay' as const,
            assetId: '0',
        }
        const original = mockAsset

        beforeEach(() => {
            mockAsset = ERC20
        })

        afterEach(() => {
            mockAsset = original
        })

        it('shows an app-filled 18-decimal amount at six decimals when blurred', () => {
            renderHook(() =>
                useSwapAmountSection({
                    ...payProps,
                    amount: exact,
                    onAmountChange: vi.fn(),
                }),
            )

            expect(formatCurrency).toHaveBeenLastCalledWith(
                new Decimal('0.007985'),
                6,
                '',
                undefined,
                false,
                0,
            )
        })

        it('seeds the focused field with the rounded amount', () => {
            const { result } = renderHook(() =>
                useSwapAmountSection({
                    ...payProps,
                    amount: exact,
                    onAmountChange: vi.fn(),
                }),
            )

            act(() => result.current.handleFocus())

            expect(result.current.displayValue).toBe('0.007985')
        })

        it('keeps what the user typed across blur and refocus, and reports the exact value', () => {
            const onAmountChange = vi.fn()
            const { result, rerender } = renderHook(
                (props: { amount: Decimal | null }) =>
                    useSwapAmountSection({
                        ...payProps,
                        amount: props.amount,
                        onAmountChange,
                    }),
                { initialProps: { amount: null as Decimal | null } },
            )

            act(() => result.current.handleFocus())
            act(() => result.current.handleTextChange('0.0079852331'))
            const emitted = onAmountChange.mock.calls.at(-1)?.[0] as Decimal
            rerender({ amount: emitted })
            act(() => result.current.handleBlur())
            act(() => result.current.handleFocus())

            expect(emitted).toEqual(new Decimal('0.0079852331'))
            expect(result.current.displayValue).toBe('0.0079852331')
        })

        it('restores the asset amount in the focused field after a fiat round trip', () => {
            const onAmountChange = vi.fn()
            const typed = new Decimal('1.5')
            const { result, rerender } = renderHook(
                (props: { amount: Decimal | null; isFiat: boolean }) =>
                    useSwapAmountSection({
                        ...payProps,
                        amount: props.amount,
                        onAmountChange,
                        isLocalCurrencyInput: props.isFiat,
                        assetToFiat,
                    }),
                {
                    initialProps: {
                        amount: null as Decimal | null,
                        isFiat: false,
                    },
                },
            )

            act(() => result.current.handleFocus())
            act(() => result.current.handleTextChange('1.5'))
            rerender({ amount: typed, isFiat: false })
            act(() => result.current.handleBlur())
            rerender({ amount: typed, isFiat: true })
            rerender({ amount: typed, isFiat: false })
            act(() => result.current.handleFocus())

            expect(result.current.displayValue).toBe('1.5')
        })

        it('leaves a six-decimal amount unchanged', () => {
            mockAsset = original

            renderHook(() =>
                useSwapAmountSection({
                    ...payProps,
                    amount: new Decimal('1.234567'),
                    onAmountChange: vi.fn(),
                }),
            )

            expect(formatCurrency).toHaveBeenLastCalledWith(
                new Decimal('1.234567'),
                6,
                '',
                undefined,
                false,
                0,
            )
        })

        it('rounds the receive figure down', () => {
            renderHook(() =>
                useSwapAmountSection({
                    scope: SCOPE,
                    variant: 'receive',
                    assetId: '0',
                    amount: new Decimal('0.0079859999999999'),
                }),
            )

            expect(formatCurrency).toHaveBeenLastCalledWith(
                new Decimal('0.007985'),
                6,
                '',
                undefined,
                false,
                0,
            )
        })

        it('fills the field from a MAX amount without changing the amount itself', () => {
            const onAmountChange = vi.fn()
            const max = new Decimal('1.234567891234567891')
            const { result } = renderHook(() =>
                useSwapAmountSection({
                    ...payProps,
                    amount: max,
                    onAmountChange,
                }),
            )

            act(() => result.current.handleFocus())

            expect(result.current.displayValue).toBe('1.234567')
            expect(onAmountChange).not.toHaveBeenCalled()
        })
    })

    describe('receive asset metadata', () => {
        const receiveProps = {
            scope: SCOPE,
            variant: 'receive' as const,
            assetId: '0',
            amount: new Decimal(2),
        }

        const quoteFor = (overrides: {
            assetId?: string
            logo?: string
            amountOutUsdValue?: string | null
            verificationTier?: string
        }) =>
            ({
                assetOut: {
                    assetId: overrides.assetId ?? '0',
                    ref: {
                        chainId: SCOPE.chainId,
                        networkId: SCOPE.networkId,
                        assetId: overrides.assetId ?? '0',
                    },
                    decimals: 6,
                    logo: overrides.logo,
                    verificationTier: overrides.verificationTier ?? 'verified',
                },
                // 2 display units.
                amountOut: new Decimal(2_000_000),
                amountOutUsdValue:
                    overrides.amountOutUsdValue === undefined
                        ? '3.00'
                        : overrides.amountOutUsdValue,
            }) as unknown as SwapQuote

        afterEach(() => {
            mockPrices = new Map()
        })

        it('fetches the price of a receive asset the account may not hold', () => {
            renderHook(() => useSwapAmountSection(receiveProps))

            expect(mockUseAssetPricesQuery).toHaveBeenCalledWith(
                SCOPE,
                ['0'],
                true,
                { fetchMissing: true },
            )
        })

        it('leaves the pay asset to the stored prices', () => {
            const { result } = renderHook(() =>
                useSwapAmountSection({
                    scope: SCOPE,
                    variant: 'pay',
                    assetId: '0',
                    amount: null,
                    onAmountChange: vi.fn(),
                }),
            )

            expect(mockUseAssetPricesQuery).toHaveBeenCalledWith(
                SCOPE,
                ['0'],
                false,
                { fetchMissing: true },
            )
            expect(result.current.usdPrice).toBeUndefined()
        })

        it('prefers the stored price over the quote', () => {
            mockPrices = new Map([
                ['0', { assetId: '0', usdPrice: new Decimal('1.01') }],
            ])

            const { result } = renderHook(() =>
                useSwapAmountSection({
                    ...receiveProps,
                    quote: quoteFor({}),
                }),
            )

            expect(result.current.usdPrice).toEqual(new Decimal('1.01'))
        })

        it('prices the asset from the quote when no price is stored', () => {
            const { result } = renderHook(() =>
                useSwapAmountSection({
                    ...receiveProps,
                    quote: quoteFor({}),
                }),
            )

            expect(result.current.usdPrice).toEqual(new Decimal('1.5'))
        })

        it.each([
            ['has no usd value', { amountOutUsdValue: null }],
            ['is for another asset', { assetId: '31566704' }],
        ])('leaves the price unknown when the quote %s', (_name, overrides) => {
            const { result } = renderHook(() =>
                useSwapAmountSection({
                    ...receiveProps,
                    quote: quoteFor(overrides),
                }),
            )

            expect(result.current.usdPrice).toBeUndefined()
        })

        it('takes the logo from the quote when the stored asset has none', () => {
            const { result } = renderHook(() =>
                useSwapAmountSection({
                    ...receiveProps,
                    quote: quoteFor({ logo: 'https://logo/usdc.png' }),
                }),
            )

            expect(result.current.asset?.peraMetadata?.logo).toBe(
                'https://logo/usdc.png',
            )
        })

        it.each([
            ['suspicious', 'suspicious'],
            ['trusted', 'unverified'],
        ])('takes a router tier of %s as %s', (verificationTier, expected) => {
            const { result } = renderHook(() =>
                useSwapAmountSection({
                    ...receiveProps,
                    quote: quoteFor({
                        logo: 'https://logo/usdc.png',
                        verificationTier,
                    }),
                }),
            )

            expect(result.current.asset?.peraMetadata?.verificationTier).toBe(
                expected,
            )
        })

        it('keeps a stored logo over the quote', () => {
            const original = mockAsset
            mockAsset = {
                ...original,
                peraMetadata: {
                    isDeleted: false,
                    verificationTier: 'verified',
                    logo: 'https://logo/stored.png',
                },
            } as typeof original
            try {
                const { result } = renderHook(() =>
                    useSwapAmountSection({
                        ...receiveProps,
                        quote: quoteFor({ logo: 'https://logo/usdc.png' }),
                    }),
                )

                expect(result.current.asset?.peraMetadata?.logo).toBe(
                    'https://logo/stored.png',
                )
            } finally {
                mockAsset = original
            }
        })
    })
})

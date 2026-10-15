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

import { vi, describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useCurrency } from '../useCurrency'
import { Decimal } from 'decimal.js'
import { useCurrenciesStore } from '../../store'

const ALGORAND_TESTNET = { chainId: 'algorand', networkId: 'testnet' } as const
const ETHEREUM_SEPOLIA = { chainId: 'ethereum', networkId: 'sepolia' } as const
const ALGORAND_BETANET = { chainId: 'algorand', networkId: 'betanet' } as const

const DESCRIPTORS = {
    algorand: { displayName: 'Algorand', nativeAsset: { symbol: 'ALGO' } },
    ethereum: { displayName: 'Ethereum', nativeAsset: { symbol: 'ETH' } },
} as const

vi.mock('@perawallet/wallet-extension-provider', () => ({
    getProvider: () => ({
        chains: {
            get: (chainId: keyof typeof DESCRIPTORS) => ({
                descriptor: DESCRIPTORS[chainId],
            }),
        },
    }),
}))

// Mock the store
vi.mock('../../store', () => ({
    useCurrenciesStore: vi.fn(),
}))

// Mock the data hooks
const mockUsePreferredCurrencyPriceQuery = vi.hoisted(() => vi.fn())
vi.mock('../usePreferredCurrencyPriceQuery', () => ({
    usePreferredCurrencyPriceQuery: mockUsePreferredCurrencyPriceQuery,
}))

const mockUseNativeUsdPriceQuery = vi.hoisted(() => vi.fn())
vi.mock('../useNativeUsdPriceQuery', () => ({
    useNativeUsdPriceQuery: mockUseNativeUsdPriceQuery,
}))

describe('services/currencies/hooks', () => {
    let mockUseAppStore: any

    beforeEach(() => {
        vi.clearAllMocks()
        mockUseAppStore = vi.mocked(useCurrenciesStore)

        mockUseNativeUsdPriceQuery.mockReturnValue({
            data: undefined,
            isPending: false,
        })
    })

    describe('useCurrency', () => {
        it('returns preferredCurrency and setPreferredCurrency from store', () => {
            const mockPreferredCurrency = 'EUR'
            const mockSetPreferredCurrency = vi.fn()

            mockUseAppStore.mockImplementation((selector: any) =>
                selector({
                    preferredCurrency: mockPreferredCurrency,
                    setPreferredCurrency: mockSetPreferredCurrency,
                }),
            )

            mockUsePreferredCurrencyPriceQuery.mockReturnValue({
                data: { usdPrice: new Decimal('1.0') },
                isPending: false,
            })

            const { result } = renderHook(() => useCurrency(ALGORAND_TESTNET))

            expect(result.current.preferredCurrency).toBe(mockPreferredCurrency)
            expect(result.current.setPreferredCurrency).toBe(
                mockSetPreferredCurrency,
            )
        })

        it('calls setPreferredCurrency when updating currency', () => {
            const mockSetPreferredCurrency = vi.fn()

            mockUseAppStore.mockImplementation((selector: any) =>
                selector({
                    preferredCurrency: 'USD',
                    setPreferredCurrency: mockSetPreferredCurrency,
                }),
            )

            mockUsePreferredCurrencyPriceQuery.mockReturnValue({
                data: { usdPrice: new Decimal('1.0') },
                isPending: false,
            })

            const { result } = renderHook(() => useCurrency(ALGORAND_TESTNET))

            act(() => {
                result.current.setPreferredCurrency('GBP')
            })

            expect(mockSetPreferredCurrency).toHaveBeenCalledWith('GBP')
        })

        it('returns usdToPreferred function', () => {
            mockUseAppStore.mockImplementation((selector: any) =>
                selector({
                    preferredCurrency: 'USD',
                }),
            )

            mockUsePreferredCurrencyPriceQuery.mockReturnValue({
                data: { usdPrice: new Decimal('1.0') },
                isPending: false,
            })

            const { result } = renderHook(() => useCurrency(ALGORAND_TESTNET))

            expect(typeof result.current.usdToPreferred).toBe('function')
        })

        it('converts USD to preferred currency correctly', () => {
            mockUseAppStore.mockImplementation((selector: any) =>
                selector({
                    preferredCurrency: 'EUR',
                }),
            )

            mockUsePreferredCurrencyPriceQuery.mockReturnValue({
                data: { usdPrice: new Decimal('0.85') },
                isPending: false,
            })

            const { result } = renderHook(() => useCurrency(ALGORAND_TESTNET))

            const usdAmount = new Decimal(100)
            const converted = result.current.usdToPreferred(usdAmount)

            expect(converted).toEqual(new Decimal(85))
        })

        it('returns null while the preferred-currency rate is pending', () => {
            mockUseAppStore.mockImplementation((selector: any) =>
                selector({
                    preferredCurrency: 'EUR',
                }),
            )

            mockUsePreferredCurrencyPriceQuery.mockReturnValue({
                data: undefined,
                isPending: true,
            })

            const { result } = renderHook(() => useCurrency(ALGORAND_TESTNET))

            const usdAmount = new Decimal(100)
            const converted = result.current.usdToPreferred(usdAmount)

            expect(converted).toBeNull()
        })

        it('returns null when the resolved rate is missing', () => {
            mockUseAppStore.mockImplementation((selector: any) =>
                selector({
                    preferredCurrency: 'EUR',
                }),
            )

            mockUsePreferredCurrencyPriceQuery.mockReturnValue({
                data: { usdPrice: undefined },
                isPending: false,
            })

            const { result } = renderHook(() => useCurrency(ALGORAND_TESTNET))

            const usdAmount = new Decimal(100)
            const converted = result.current.usdToPreferred(usdAmount)

            expect(converted).toBeNull()
        })

        it('returns null when the resolved rate is zero', () => {
            mockUseAppStore.mockImplementation((selector: any) =>
                selector({
                    preferredCurrency: 'EUR',
                }),
            )

            mockUsePreferredCurrencyPriceQuery.mockReturnValue({
                data: { usdPrice: new Decimal('0') },
                isPending: false,
            })

            const { result } = renderHook(() => useCurrency(ALGORAND_TESTNET))

            const usdAmount = new Decimal(100)
            const converted = result.current.usdToPreferred(usdAmount)

            expect(converted).toBeNull()
        })

        it('treats a zero fiat rate as pending even on a network without a Pera backend', () => {
            // Fiat rates come from the wallet mode's deployment, so the
            // network's missing backend never makes a zero fiat rate real.
            mockUseAppStore.mockImplementation((selector: any) =>
                selector({ preferredCurrency: 'EUR' }),
            )

            mockUsePreferredCurrencyPriceQuery.mockReturnValue({
                data: { usdPrice: new Decimal('0') },
                isPending: false,
            })

            const { result } = renderHook(() => useCurrency(ALGORAND_BETANET))

            expect(result.current.isRatePending).toBe(true)
            expect(result.current.usdToPreferred(new Decimal(100))).toBeNull()
        })

        it('passes an unknown USD amount through as unknown', () => {
            // An unpriced total is unknown, not zero. Converting it must not
            // manufacture a number even when the rate itself is fine.
            mockUseAppStore.mockImplementation((selector: any) =>
                selector({ preferredCurrency: 'EUR' }),
            )

            mockUsePreferredCurrencyPriceQuery.mockReturnValue({
                data: { usdPrice: new Decimal('0.85') },
                isPending: false,
            })

            const { result } = renderHook(() => useCurrency(ALGORAND_TESTNET))

            expect(result.current.usdToPreferred(null)).toBeNull()
        })

        it('reports isRatePending while the fiat rate is unresolved', () => {
            mockUseAppStore.mockImplementation((selector: any) =>
                selector({ preferredCurrency: 'EUR' }),
            )

            mockUsePreferredCurrencyPriceQuery.mockReturnValue({
                data: undefined,
                isPending: true,
            })

            const { result } = renderHook(() => useCurrency(ALGORAND_TESTNET))

            expect(result.current.isRatePending).toBe(true)
        })

        it('clears isRatePending once the fiat rate resolves', () => {
            mockUseAppStore.mockImplementation((selector: any) =>
                selector({ preferredCurrency: 'EUR' }),
            )

            mockUsePreferredCurrencyPriceQuery.mockReturnValue({
                data: { usdPrice: new Decimal('0.85') },
                isPending: false,
            })

            const { result } = renderHook(() => useCurrency(ALGORAND_TESTNET))

            expect(result.current.isRatePending).toBe(false)
        })

        it('never reports isRatePending when the preferred currency is USD', () => {
            mockUseAppStore.mockImplementation((selector: any) =>
                selector({ preferredCurrency: 'USD' }),
            )

            mockUsePreferredCurrencyPriceQuery.mockReturnValue({
                data: undefined,
                isPending: true,
            })

            const { result } = renderHook(() => useCurrency(ALGORAND_TESTNET))

            expect(result.current.isRatePending).toBe(false)
        })

        it('converts with decimal precision', () => {
            mockUseAppStore.mockImplementation((selector: any) =>
                selector({
                    preferredCurrency: 'JPY',
                }),
            )

            mockUsePreferredCurrencyPriceQuery.mockReturnValue({
                data: { usdPrice: new Decimal('150.5') },
                isPending: false,
            })

            const { result } = renderHook(() => useCurrency(ALGORAND_TESTNET))

            const usdAmount = new Decimal(2.5)
            const converted = result.current.usdToPreferred(usdAmount)

            expect(converted).toEqual(new Decimal(376.25))
        })

        it('returns USD amount unchanged when preferred currency is USD', () => {
            mockUseAppStore.mockImplementation((selector: any) =>
                selector({ preferredCurrency: 'USD' }),
            )
            mockUsePreferredCurrencyPriceQuery.mockReturnValue({
                data: { usdPrice: new Decimal('1.0') },
                isPending: false,
            })

            const { result } = renderHook(() => useCurrency(ALGORAND_TESTNET))

            const usdAmount = new Decimal(100)
            const converted = result.current.usdToPreferred(usdAmount)

            expect(converted).toEqual(new Decimal(100))
        })

        it('converts USD to the native asset of an Ethereum scope', () => {
            mockUseAppStore.mockImplementation((selector: any) =>
                selector({ preferredCurrency: 'ETH' }),
            )
            mockUsePreferredCurrencyPriceQuery.mockReturnValue({
                data: undefined,
                isPending: false,
            })
            mockUseNativeUsdPriceQuery.mockReturnValue({
                data: new Decimal('2000'),
                isPending: false,
            })

            const { result } = renderHook(() => useCurrency(ETHEREUM_SEPOLIA))

            expect(mockUseNativeUsdPriceQuery).toHaveBeenCalledWith(
                ETHEREUM_SEPOLIA,
                true,
            )
            expect(
                result.current.usdToPreferred(new Decimal('1000'))?.toString(),
            ).toBe('0.5')
        })

        it('converts USD to ALGO when preferred currency is ALGO', () => {
            mockUseAppStore.mockImplementation((selector: any) =>
                selector({ preferredCurrency: 'ALGO' }),
            )

            mockUsePreferredCurrencyPriceQuery.mockReturnValue({
                data: undefined,
                isPending: false,
            })

            mockUseNativeUsdPriceQuery.mockReturnValue({
                data: new Decimal('0.15'),
                isPending: false,
            })

            const { result } = renderHook(() => useCurrency(ALGORAND_TESTNET))

            // $1.50 / $0.15 per ALGO = 10 ALGO
            const converted = result.current.usdToPreferred(new Decimal('1.50'))
            expect(converted).toEqual(new Decimal(10))
        })

        it('returns null when preferred is ALGO and price is pending', () => {
            mockUseAppStore.mockImplementation((selector: any) =>
                selector({ preferredCurrency: 'ALGO' }),
            )

            mockUsePreferredCurrencyPriceQuery.mockReturnValue({
                data: undefined,
                isPending: false,
            })

            mockUseNativeUsdPriceQuery.mockReturnValue({
                data: undefined,
                isPending: true,
            })

            const { result } = renderHook(() => useCurrency(ALGORAND_TESTNET))

            const converted = result.current.usdToPreferred(new Decimal(100))
            expect(converted).toBeNull()
        })

        it('reports isRatePending while the ALGO rate is unresolved', () => {
            mockUseAppStore.mockImplementation((selector: any) =>
                selector({ preferredCurrency: 'ALGO' }),
            )

            mockUsePreferredCurrencyPriceQuery.mockReturnValue({
                data: undefined,
                isPending: false,
            })

            mockUseNativeUsdPriceQuery.mockReturnValue({
                data: undefined,
                isPending: true,
            })

            const { result } = renderHook(() => useCurrency(ALGORAND_TESTNET))

            expect(result.current.isRatePending).toBe(true)
        })

        it('returns null when preferred is ALGO and price is zero', () => {
            mockUseAppStore.mockImplementation((selector: any) =>
                selector({ preferredCurrency: 'ALGO' }),
            )

            mockUsePreferredCurrencyPriceQuery.mockReturnValue({
                data: undefined,
                isPending: false,
            })

            mockUseNativeUsdPriceQuery.mockReturnValue({
                data: new Decimal(0),
                isPending: false,
            })

            const { result } = renderHook(() => useCurrency(ALGORAND_TESTNET))

            const converted = result.current.usdToPreferred(new Decimal(100))
            expect(converted).toBeNull()
        })

        it('exposes nativeUsdPrice from the query', () => {
            mockUseAppStore.mockImplementation((selector: any) =>
                selector({ preferredCurrency: 'ALGO' }),
            )

            mockUsePreferredCurrencyPriceQuery.mockReturnValue({
                data: undefined,
                isPending: false,
            })

            mockUseNativeUsdPriceQuery.mockReturnValue({
                data: new Decimal('0.15'),
                isPending: false,
            })

            const { result } = renderHook(() => useCurrency(ALGORAND_TESTNET))

            expect(result.current.nativeUsdPrice).toEqual(new Decimal('0.15'))
        })

        it('leaves nativeUsdPrice null until the rate loads', () => {
            mockUseAppStore.mockImplementation((selector: any) =>
                selector({ preferredCurrency: 'USD' }),
            )

            mockUsePreferredCurrencyPriceQuery.mockReturnValue({
                data: { usdPrice: new Decimal('1.0') },
                isPending: false,
            })

            const { result } = renderHook(() => useCurrency(ALGORAND_TESTNET))

            expect(result.current.nativeUsdPrice).toBeNull()
        })
    })
})

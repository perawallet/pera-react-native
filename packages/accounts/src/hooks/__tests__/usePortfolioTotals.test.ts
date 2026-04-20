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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { Decimal } from 'decimal.js'
import { usePortfolioTotals } from '../usePortfolioTotals'
import type { AccountBalance, AccountBalances } from '../../models'

const mockAssetPrices = new Map<string, { usdPrice: Decimal }>()
let mockIsPending = false

vi.mock('@perawallet/wallet-core-assets', () => ({
    useAssetPricesQuery: vi.fn(() => ({
        data: mockAssetPrices,
        isPending: mockIsPending,
    })),
}))

vi.mock('@perawallet/wallet-core-currencies', () => ({
    useCurrency: () => ({ usdToPreferred: (v: Decimal) => v }),
}))

const buildBalance = (
    assetBalances: { assetId: string; amount: Decimal }[],
): AccountBalance => ({
    assetBalances: assetBalances.map(b => ({
        ...b,
        algoValue: new Decimal(0),
    })),
    algoValue: new Decimal(0),
    isPending: false,
    isFetched: true,
    isRefetching: false,
    isError: false,
})

describe('usePortfolioTotals', () => {
    beforeEach(() => {
        mockAssetPrices.clear()
        mockIsPending = false
    })

    it('returns zero totals and empty map when there are no accounts', () => {
        const { result } = renderHook(() => usePortfolioTotals(new Map()))

        expect(result.current.portfolioUsdValue).toEqual(new Decimal(0))
        expect(result.current.accountUsdValues.size).toBe(0)
        expect(result.current.isPending).toBe(false)
    })

    it('aggregates USD values across accounts using asset prices', () => {
        mockAssetPrices.set('100', { usdPrice: new Decimal(2) })
        mockAssetPrices.set('200', { usdPrice: new Decimal(0.5) })

        const balances: AccountBalances = new Map()
        balances.set(
            'ADDR1',
            buildBalance([
                { assetId: '100', amount: new Decimal(3) }, // 3 * 2 = 6
                { assetId: '200', amount: new Decimal(10) }, // 10 * 0.5 = 5
            ]),
        )
        balances.set(
            'ADDR2',
            buildBalance([
                { assetId: '100', amount: new Decimal(1) }, // 1 * 2 = 2
            ]),
        )

        const { result } = renderHook(() => usePortfolioTotals(balances))

        expect(result.current.accountUsdValues.get('ADDR1')).toEqual(
            new Decimal(11),
        )
        expect(result.current.accountUsdValues.get('ADDR2')).toEqual(
            new Decimal(2),
        )
        expect(result.current.portfolioUsdValue).toEqual(new Decimal(13))
    })

    it('treats missing asset price as zero', () => {
        // no price for '999'
        const balances: AccountBalances = new Map()
        balances.set(
            'ADDR1',
            buildBalance([{ assetId: '999', amount: new Decimal(100) }]),
        )

        const { result } = renderHook(() => usePortfolioTotals(balances))

        expect(result.current.accountUsdValues.get('ADDR1')).toEqual(
            new Decimal(0),
        )
        expect(result.current.portfolioUsdValue).toEqual(new Decimal(0))
    })

    it('propagates pending state from price query', () => {
        mockIsPending = true

        const { result } = renderHook(() => usePortfolioTotals(new Map()))

        expect(result.current.isPending).toBe(true)
    })
})

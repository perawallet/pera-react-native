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

import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { Decimal } from 'decimal.js'
import { usePortfolioTotals } from '../usePortfolioTotals'
import type { AccountBalance, AccountBalances } from '../../models'

vi.mock('@perawallet/wallet-core-currencies', () => ({
    useCurrency: () => ({ usdToPreferred: (v: Decimal) => v }),
}))

// Each asset balance now carries its joined USD price, so usePortfolioTotals
// no longer issues a separate price query.
const buildBalance = (
    assetBalances: { assetId: string; amount: Decimal; usdPrice?: Decimal }[],
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
    it('returns zero totals and empty map when there are no accounts', () => {
        const { result } = renderHook(() => usePortfolioTotals(new Map()))

        expect(result.current.portfolioUsdValue).toEqual(new Decimal(0))
        expect(result.current.accountUsdValues.size).toBe(0)
        expect(result.current.isPending).toBe(false)
    })

    it('aggregates USD values across accounts using each holding price', () => {
        const balances: AccountBalances = new Map()
        balances.set(
            'ADDR1',
            buildBalance([
                { assetId: '100', amount: new Decimal(3), usdPrice: new Decimal(2) }, // 6
                { assetId: '200', amount: new Decimal(10), usdPrice: new Decimal(0.5) }, // 5
            ]),
        )
        balances.set(
            'ADDR2',
            buildBalance([
                { assetId: '100', amount: new Decimal(1), usdPrice: new Decimal(2) }, // 2
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

    it('treats a missing holding price as zero', () => {
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
})

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

import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { Decimal } from 'decimal.js'
import { usePortfolioTotals } from '../usePortfolioTotals'
import type { AccountBalance, AccountBalances } from '../../models'

// The per-holding arithmetic lives in `useAccountBalancesQuery`, which computes
// `usdValue` in the same pass as `algoValue`; this hook only rolls it up.
const buildBalance = (usdValue: Decimal): AccountBalance => ({
    assetBalances: [],
    algoValue: new Decimal(0),
    usdValue,
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

    it('aggregates each account USD value into the portfolio total', () => {
        const balances: AccountBalances = new Map()
        balances.set('ADDR1', buildBalance(new Decimal(11)))
        balances.set('ADDR2', buildBalance(new Decimal(2)))

        const { result } = renderHook(() => usePortfolioTotals(balances))

        expect(result.current.accountUsdValues.get('ADDR1')).toEqual(
            new Decimal(11),
        )
        expect(result.current.accountUsdValues.get('ADDR2')).toEqual(
            new Decimal(2),
        )
        expect(result.current.portfolioUsdValue).toEqual(new Decimal(13))
    })

    it('keeps the totals stable across re-renders', () => {
        const balances: AccountBalances = new Map([
            ['ADDR1', buildBalance(new Decimal(7))],
        ])

        const { result, rerender } = renderHook(() =>
            usePortfolioTotals(balances),
        )
        const first = result.current
        rerender()

        expect(result.current).toBe(first)
    })
})

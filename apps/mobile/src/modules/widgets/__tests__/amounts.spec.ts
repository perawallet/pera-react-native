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
import { Decimal } from 'decimal.js'
import {
    resolveWidgetAmounts,
    type ResolveWidgetAmountsInput,
} from '../amounts'

const usdToEur = (usd: Decimal | null | undefined) => (usd ? usd.mul(2) : null)

const base = (): ResolveWidgetAmountsInput => ({
    preferredCurrency: 'EUR',
    isRatePending: false,
    usdToPreferred: usdToEur,
    algoUsdPrice: new Decimal('0.2'),
    isPricePending: false,
    priceUpdatedAt: 1000,
    portfolioUsdValue: new Decimal('100'),
    portfolioNativeValue: new Decimal('500'),
    isPortfolioPending: false,
})

describe('resolveWidgetAmounts', () => {
    it('converts price and portfolio into the preferred currency', () => {
        const { algoPrice, portfolio } = resolveWidgetAmounts(base())

        expect(algoPrice).toEqual({
            value: new Decimal('0.4'),
            currencyCode: 'EUR',
            asOf: 1000,
        })
        expect(portfolio).toEqual({
            value: new Decimal('200'),
            currencyCode: 'EUR',
            algoValue: new Decimal('500'),
            asOf: 1000,
        })
    })

    it('shows the price in USD when ALGO is the preferred currency', () => {
        const { algoPrice, portfolio } = resolveWidgetAmounts({
            ...base(),
            preferredCurrency: 'ALGO',
        })

        expect(algoPrice).toMatchObject({
            value: new Decimal('0.2'),
            currencyCode: 'USD',
        })
        expect(portfolio).toMatchObject({
            value: new Decimal('500'),
            currencyCode: 'ALGO',
        })
    })

    it('reports both as loading while the rate is pending', () => {
        const { algoPrice, portfolio } = resolveWidgetAmounts({
            ...base(),
            isRatePending: true,
        })

        expect(algoPrice).toBeUndefined()
        expect(portfolio).toBeUndefined()
    })

    it('reports the price as loading while the price query is pending', () => {
        expect(
            resolveWidgetAmounts({ ...base(), isPricePending: true }).algoPrice,
        ).toBeUndefined()
    })

    it('reports the portfolio as loading while totals are pending', () => {
        expect(
            resolveWidgetAmounts({ ...base(), isPortfolioPending: true })
                .portfolio,
        ).toBeUndefined()
    })

    it('keeps an unknown portfolio USD value as null, not zero', () => {
        const { portfolio } = resolveWidgetAmounts({
            ...base(),
            portfolioUsdValue: null,
        })

        expect(portfolio?.value).toBeNull()
    })
})

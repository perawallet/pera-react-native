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
    resolvePortfolioFeed,
    resolvePriceFeed,
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
    isPriceError: false,
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

    // TestNet often never resolves a fiat rate; the ALGO balance must not wait on it.
    it('keeps the ALGO balance and leaves fiat unknown while the rate is unresolved', () => {
        const { algoPrice, portfolio } = resolveWidgetAmounts({
            ...base(),
            isRatePending: true,
        })

        expect(algoPrice?.value).toBeNull()
        expect(portfolio).toMatchObject({
            value: null,
            algoValue: new Decimal('500'),
        })
    })

    it('leaves fiat unknown, rather than loading, when the price query failed', () => {
        const { algoPrice, portfolio } = resolveWidgetAmounts({
            ...base(),
            isPriceError: true,
        })

        expect(algoPrice?.value).toBeNull()
        expect(portfolio).toMatchObject({
            value: null,
            algoValue: new Decimal('500'),
        })
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

    it('carries an unknown ALGO total through as null, never a partial sum', () => {
        const { portfolio } = resolveWidgetAmounts({
            ...base(),
            portfolioNativeValue: null,
        })

        expect(portfolio?.algoValue).toBeNull()
    })

    it('keeps an unknown portfolio USD value as null, not zero', () => {
        const { portfolio } = resolveWidgetAmounts({
            ...base(),
            portfolioUsdValue: null,
        })

        expect(portfolio?.value).toBeNull()
    })
})

describe('resolvePriceFeed', () => {
    it('points the widget at the network backend in the preferred currency', () => {
        const feed = resolvePriceFeed({
            backendUrl: 'https://mainnet.api.example',
            apiKey: 'key',
            preferredCurrency: 'EUR',
        })

        expect(feed).toEqual({
            backendUrl: 'https://mainnet.api.example',
            apiKey: 'key',
            currencyCode: 'EUR',
        })
    })

    it('prices in USD when ALGO is the preferred currency', () => {
        const feed = resolvePriceFeed({
            backendUrl: 'https://mainnet.api.example',
            apiKey: 'key',
            preferredCurrency: 'ALGO',
        })

        expect(feed?.currencyCode).toBe('USD')
    })

    it('is null on a network without a Pera backend', () => {
        const feed = resolvePriceFeed({
            backendUrl: '',
            apiKey: 'key',
            preferredCurrency: 'EUR',
        })

        expect(feed).toBeNull()
    })
})

describe('resolvePortfolioFeed', () => {
    it('shares the accounts and the app chart period', () => {
        const accounts = [
            { address: 'A', name: 'Main' },
            { address: 'B', name: 'Savings' },
        ]

        const feed = resolvePortfolioFeed({
            accounts,
            storedPeriod: 'one-month',
            isPrivacyMode: false,
        })

        expect(feed).toEqual({ accounts, period: 'one-month' })
    })

    it('falls back to one week, like the home chart, when no period is stored', () => {
        const feed = resolvePortfolioFeed({
            accounts: [{ address: 'A', name: 'Main' }],
            storedPeriod: undefined,
            isPrivacyMode: false,
        })

        expect(feed?.period).toBe('one-week')
    })

    it('shares nothing in privacy mode', () => {
        const feed = resolvePortfolioFeed({
            accounts: [{ address: 'A', name: 'Main' }],
            storedPeriod: 'one-day',
            isPrivacyMode: true,
        })

        expect(feed).toBeNull()
    })

    it('is null without accounts', () => {
        const feed = resolvePortfolioFeed({
            accounts: [],
            storedPeriod: 'one-day',
            isPrivacyMode: false,
        })

        expect(feed).toBeNull()
    })
})

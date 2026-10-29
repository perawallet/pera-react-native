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

import type { Decimal } from 'decimal.js'
import {
    HISTORY_PERIODS,
    isAlgoAssetName,
    type HistoryPeriod,
    type Maybe,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import type {
    BuildWidgetSnapshotInput,
    WidgetPortfolioFeed,
    WidgetPriceFeed,
} from './snapshot'

const USD = 'USD'

export type ResolveWidgetAmountsInput = {
    preferredCurrency: string
    isRatePending: boolean
    usdToPreferred: (usd: Maybe<Decimal>) => Nullable<Decimal>
    /** Price of one ALGO in USD, display units. */
    algoUsdPrice: Nullable<Decimal>
    isPricePending: boolean
    isPriceError: boolean
    /** Epoch ms. */
    priceUpdatedAt: number
    portfolioUsdValue: Nullable<Decimal>
    /** Display units of ALGO; null when any account's value is unknown. */
    portfolioNativeValue: Nullable<Decimal>
    isPortfolioPending: boolean
}

export const resolveWidgetAmounts = (
    input: ResolveWidgetAmountsInput,
): Pick<BuildWidgetSnapshotInput, 'algoPrice' | 'portfolio'> => {
    const isAlgoPreferred = isAlgoAssetName(input.preferredCurrency)
    // A rate or price that never resolves (common on TestNet) makes fiat
    // unknown, never "loading": waiting on it would hold back the ALGO balance.
    const hasFiat =
        !input.isPriceError && (isAlgoPreferred || !input.isRatePending)
    const asOf = input.priceUpdatedAt
    const algoFiatPrice = () =>
        isAlgoPreferred
            ? input.algoUsdPrice
            : input.usdToPreferred(input.algoUsdPrice)
    const portfolioValue = () => {
        if (isAlgoPreferred) return input.portfolioNativeValue
        return hasFiat ? input.usdToPreferred(input.portfolioUsdValue) : null
    }

    // "1 ALGO = 1 ALGO" says nothing, so an ALGO-preferred user sees the USD price.
    const algoPrice = input.isPricePending
        ? undefined
        : {
              value: hasFiat ? algoFiatPrice() : null,
              currencyCode: isAlgoPreferred ? USD : input.preferredCurrency,
              asOf,
          }

    const portfolio = input.isPortfolioPending
        ? undefined
        : {
              value: portfolioValue(),
              currencyCode: input.preferredCurrency,
              algoValue: input.portfolioNativeValue,
              asOf,
          }

    return { algoPrice, portfolio }
}

export const resolvePriceFeed = ({
    backendUrl,
    apiKey,
    preferredCurrency,
}: {
    /** Empty when the network has no Pera backend. */
    backendUrl: string
    apiKey: string
    preferredCurrency: string
}): WidgetPriceFeed =>
    backendUrl
        ? {
              backendUrl,
              apiKey,
              currencyCode: isAlgoAssetName(preferredCurrency)
                  ? USD
                  : preferredCurrency,
          }
        : null

// Matches the home chart's default when no period has been chosen yet.
const DEFAULT_PERIOD: HistoryPeriod = 'one-week'

const isHistoryPeriod = (value: unknown): value is HistoryPeriod =>
    HISTORY_PERIODS.includes(value as HistoryPeriod)

export const resolvePortfolioFeed = ({
    accounts,
    storedPeriod,
    isPrivacyMode,
}: {
    /** `name` is the display name the app shows for the account. */
    accounts: { address: string; name: string }[]
    /** The app's chart period preference, as stored. */
    storedPeriod: unknown
    isPrivacyMode: boolean
}): WidgetPortfolioFeed =>
    isPrivacyMode || accounts.length === 0
        ? null
        : {
              accounts,
              period: isHistoryPeriod(storedPeriod)
                  ? storedPeriod
                  : DEFAULT_PERIOD,
          }

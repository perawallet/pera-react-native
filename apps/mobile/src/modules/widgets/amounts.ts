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
    isAlgoAssetName,
    type Maybe,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import type { BuildWidgetSnapshotInput } from './snapshot'

const USD = 'USD'

export type ResolveWidgetAmountsInput = {
    preferredCurrency: string
    isRatePending: boolean
    usdToPreferred: (usd: Maybe<Decimal>) => Nullable<Decimal>
    /** Price of one ALGO in USD, display units. */
    algoUsdPrice: Nullable<Decimal>
    isPricePending: boolean
    /** Epoch ms. */
    priceUpdatedAt: number
    portfolioUsdValue: Nullable<Decimal>
    /** Display units of ALGO. */
    portfolioNativeValue: Decimal
    isPortfolioPending: boolean
}

export const resolveWidgetAmounts = (
    input: ResolveWidgetAmountsInput,
): Pick<BuildWidgetSnapshotInput, 'algoPrice' | 'portfolio'> => {
    const isAlgoPreferred = isAlgoAssetName(input.preferredCurrency)
    const isRateReady = isAlgoPreferred || !input.isRatePending
    const asOf = input.priceUpdatedAt

    // "1 ALGO = 1 ALGO" says nothing, so an ALGO-preferred user sees the USD price.
    const algoPrice =
        input.isPricePending || !isRateReady
            ? undefined
            : isAlgoPreferred
              ? { value: input.algoUsdPrice, currencyCode: USD, asOf }
              : {
                    value: input.usdToPreferred(input.algoUsdPrice),
                    currencyCode: input.preferredCurrency,
                    asOf,
                }

    const portfolio =
        input.isPortfolioPending || !isRateReady
            ? undefined
            : {
                  value: isAlgoPreferred
                      ? input.portfolioNativeValue
                      : input.usdToPreferred(input.portfolioUsdValue),
                  currencyCode: input.preferredCurrency,
                  algoValue: input.portfolioNativeValue,
                  asOf,
              }

    return { algoPrice, portfolio }
}

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

import type { ChainScope } from '@perawallet/wallet-core-chain-contract'

const MODULE_PREFIX = 'currencies'

export const currencyQueryKeys = {
    all: [MODULE_PREFIX] as const,
    list: (scope: ChainScope) => [MODULE_PREFIX, { scope }] as const,
    price: (scope: ChainScope, preferredFiatCurrency: string) =>
        [MODULE_PREFIX, { scope, preferredFiatCurrency }] as const,
    algoUsdPrice: (scope: ChainScope) =>
        ['assets', 'prices', 'algo-usd', { scope }] as const,
}

// Aliases for backward compatibility
export const getCurrenciesQueryKey = currencyQueryKeys.list
export const getPreferredCurrencyPriceQueryKey = currencyQueryKeys.price

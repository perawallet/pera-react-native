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

import type Decimal from 'decimal.js'
import type { BaseStoreState } from '@perawallet/wallet-core-shared'

export type Currency = {
    id: string
    name: string
    symbol: string
}

export type CurrencyPrice = {
    id: string
    usdPrice: Decimal
}

export type CurrenciesList = Currency[]

export type CurrenciesStore = BaseStoreState & {
    preferredCurrency: string
    setPreferredCurrency: (currency: string) => void
    fallbackCurrency: string
    setFallbackCurrency: (currency: string) => void
}

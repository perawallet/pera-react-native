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

import type Decimal from 'decimal.js'

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

export type CurrenciesListResponse = CurrencyResponse[]

export type CurrencyResponse = {
    readonly generated_at?: string
    currency_id: string
    name: string
    symbol: string
    readonly exchange_price?: string
    readonly last_updated_at?: string
    readonly usd_value?: string
}

export type CurrenciesStore = {
    preferredCurrency: string
    setPreferredCurrency: (currency: string) => void
}

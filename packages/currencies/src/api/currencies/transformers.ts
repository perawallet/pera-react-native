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

import { Decimal } from 'decimal.js'
import type { Currency, CurrencyPrice } from '../../models'
import type { CurrencyApiResponse } from './schema'

export const transformCurrency = (response: CurrencyApiResponse): Currency => ({
    id: response.currency_id,
    name: response.name,
    symbol: response.symbol,
})

export const transformCurrencyList = (
    responses: CurrencyApiResponse[],
): Currency[] => responses.map(transformCurrency)

export const transformCurrencyToPrice = (
    response: CurrencyApiResponse,
): CurrencyPrice => ({
    id: response.currency_id,
    usdPrice: Decimal(response.usd_value ?? '0'),
})

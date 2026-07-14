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

// Test fixtures for the currencies REST surface. Add new scenarios here as
// integration tests grow — keep them named after the shape they describe
// rather than the test that uses them, so the same fixture can be reused.

type CurrencyApiResponse = {
    currency_id: string
    name: string
    symbol: string
    usd_value?: number | null
    exchange_price?: string | null
    last_updated_at?: string | null
    generated_at?: string | null
}

export const USD_EUR_GBP: CurrencyApiResponse[] = [
    { currency_id: 'USD', name: 'US Dollar', symbol: '$', usd_value: 1 },
    { currency_id: 'EUR', name: 'Euro', symbol: '€', usd_value: 1.08 },
    { currency_id: 'GBP', name: 'British Pound', symbol: '£', usd_value: 1.27 },
]

export const JPY_ONLY: CurrencyApiResponse[] = [
    {
        currency_id: 'JPY',
        name: 'Japanese Yen',
        symbol: '¥',
        usd_value: 0.0067,
    },
]

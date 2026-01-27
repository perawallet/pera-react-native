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

import { useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Decimal } from 'decimal.js'
import type { CurrencyPrice, CurrencyResponse } from '../models'
import { fetchCurrency } from './endpoints'
import { useNetwork } from '@perawallet/wallet-core-platform-integration'
import { getPreferredCurrencyPriceQueryKey } from './querykeys'

const mapCurrencyToPrice = (data: CurrencyResponse): CurrencyPrice => {
    return {
        id: data.currency_id,
        usdPrice: Decimal(data.usd_value ?? '0'),
    }
}

export const usePreferredCurrencyPriceQuery = (
    preferredFiatCurrency: string,
) => {
    const { network } = useNetwork()
    return useQuery({
        queryKey: getPreferredCurrencyPriceQueryKey(
            network,
            preferredFiatCurrency,
        ),
        queryFn: () => fetchCurrency(network, preferredFiatCurrency),
        select: useCallback(
            (data: CurrencyResponse) => mapCurrencyToPrice(data),
            [],
        ),
    })
}

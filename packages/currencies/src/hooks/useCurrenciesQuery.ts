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

import { useQuery } from '@tanstack/react-query'
import { fetchCurrenciesList } from './endpoints'
import { useCallback, useMemo } from 'react'
import type { CurrenciesListResponse } from '../models'
import { useNetwork } from '@perawallet/wallet-core-platform-integration'
import { getCurrenciesQueryKey } from './querykeys'

export const useCurrenciesQuery = () => {
    const { network } = useNetwork()
    const results = useQuery({
        queryKey: getCurrenciesQueryKey(network),
        queryFn: () => fetchCurrenciesList(network),
        select: useCallback(
            (data: CurrenciesListResponse) =>
                data.map(currency => ({
                    id: currency.currency_id,
                    name: currency.name,
                    symbol: currency.symbol,
                })),
            [],
        ),
    })

    const dataWithAlgo = useMemo(() => {
        return results.data
            ? [
                  {
                      id: 'ALGO',
                      name: 'Algorand',
                      symbol: 'ALGO',
                  },
                  ...results.data,
              ]
            : undefined
    }, [results.data])

    return {
        ...results,
        data: dataWithAlgo,
    }
}

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

import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { fetchCurrenciesList } from '../api/currencies'
import { nativeCurrencyFor } from './nativeCurrency'
import { getCurrenciesQueryKey } from './querykeys'

export const useCurrenciesQuery = (scope: ChainScope) => {
    const results = useQuery({
        queryKey: getCurrenciesQueryKey(scope),
        queryFn: ({ signal }) => fetchCurrenciesList({ scope, signal }),
    })

    const dataWithNative = useMemo(() => {
        return results.data
            ? [nativeCurrencyFor(scope), ...results.data]
            : undefined
    }, [results.data, scope])

    return {
        ...results,
        data: dataWithNative,
    }
}

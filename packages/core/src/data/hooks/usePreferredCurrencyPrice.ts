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

import { useCurrency } from "../../services/currencies"
import { useV1CurrenciesRead, v1CurrenciesReadQueryKey, type CurrencyDetailSerializerResponse } from "../../api/index"
import { useMemo } from "react"

export const usePreferredCurrencyPriceQueryKeys = () => {
    const { preferredCurrency } = useCurrency()

    return [
        v1CurrenciesReadQueryKey({
            currency_id: preferredCurrency
        })
    ]
}

export const usePreferredCurrencyPrice = () => {
    const { preferredCurrency } = useCurrency()

    const { data, isPending, isLoading, error, isError, refetch } = useV1CurrenciesRead({
        currency_id: preferredCurrency
    })

    return useMemo<{
        data?: CurrencyDetailSerializerResponse,
        isPending: boolean,
        isError: boolean,
        error: unknown,
        refetch: () => void,
        isLoading: boolean
    }>(() => ({
        data: data,
        isPending,
        isLoading,
        error,
        isError,
        refetch
    }), [data, isPending, isLoading, error, isError, refetch])
}

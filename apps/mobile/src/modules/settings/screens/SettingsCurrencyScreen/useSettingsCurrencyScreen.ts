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

import {
    ALGO_ASSET,
    useInvalidateAssetPrices,
} from '@perawallet/wallet-core-assets'
import {
    Currency,
    useCurrenciesQuery,
    useCurrency,
} from '@perawallet/wallet-core-currencies'
import { useEffect, useMemo, useState } from 'react'

export const useSettingsCurrencyScreen = () => {
    const {
        setPreferredCurrency,
        setFallbackCurrency,
        fallbackCurrency,
        preferredCurrency,
    } = useCurrency()
    const [search, setSearch] = useState<string>()
    const [filteredData, setFilteredData] = useState<Currency[]>([])

    const { data } = useCurrenciesQuery()
    const { invalidateAssetPrices } = useInvalidateAssetPrices()

    useEffect(() => {
        if (!search?.length) {
            setFilteredData(data ?? [])
        } else {
            const lowercaseSearch = search.toLowerCase()
            setFilteredData(
                (data ?? []).filter(
                    d =>
                        d.name.toLowerCase().includes(lowercaseSearch) ||
                        d.id.toLowerCase().includes(lowercaseSearch),
                ),
            )
        }
    }, [data, search])

    const setCurrency = (currency: Currency) => {
        if (currency.id === 'ALGO') {
            setPreferredCurrency('ALGO')
            setFallbackCurrency('USD')
        } else {
            setPreferredCurrency(currency.id)
            setFallbackCurrency(currency.id)
        }
        invalidateAssetPrices()
    }

    const isAlgoPrimary = preferredCurrency === 'ALGO'

    const primaryCurrency = useMemo(() => {
        if (isAlgoPrimary) {
            return ALGO_ASSET.unitName
        }
        return preferredCurrency
    }, [isAlgoPrimary, preferredCurrency])

    const secondaryCurrency = useMemo(() => {
        if (isAlgoPrimary) {
            return fallbackCurrency
        }
        return ALGO_ASSET.unitName
    }, [isAlgoPrimary, fallbackCurrency])

    return {
        setCurrency,
        search,
        setSearch,
        filteredData,
        primaryCurrency,
        secondaryCurrency,
    }
}

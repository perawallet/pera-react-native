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
    ALGO_ASSET_UNIT_NAME,
    useInvalidateAssetPrices,
} from '@perawallet/wallet-core-assets'
import {
    Currency,
    useCurrenciesQuery,
    useCurrency,
} from '@perawallet/wallet-core-currencies'
import {
    trackEvent,
    SettingsEvent,
    AnalyticsMetadataKey,
} from '@perawallet/wallet-core-analytics'
import { useEffect, useState } from 'react'

type UseSettingsCurrencyScreenResult = {
    setCurrency: (currency: Currency) => void
    search: string | undefined
    setSearch: (v?: string) => void
    filteredData: Currency[]
    preferredCurrency: string
    fallbackCurrency: string
}

export const useSettingsCurrencyScreen =
    (): UseSettingsCurrencyScreenResult => {
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
            trackEvent(SettingsEvent.ChangeCurrency, {
                [AnalyticsMetadataKey.Id]: currency.id,
            })
            if (currency.id === 'ALGO') {
                setPreferredCurrency('ALGO')
                setFallbackCurrency('USD')
            } else {
                setPreferredCurrency(currency.id)
                setFallbackCurrency(ALGO_ASSET_UNIT_NAME)
            }
            invalidateAssetPrices()
        }

        return {
            setCurrency,
            search,
            setSearch,
            filteredData,
            preferredCurrency,
            fallbackCurrency,
        }
    }

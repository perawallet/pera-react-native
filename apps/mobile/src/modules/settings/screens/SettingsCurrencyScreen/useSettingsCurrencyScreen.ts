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

import { useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useInvalidateAssetPrices } from '@perawallet/wallet-core-assets'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import {
    ALGO_ASSET_NAME,
    isAlgoAssetName,
} from '@perawallet/wallet-core-shared'
import {
    USD_CURRENCY_ID,
    currencyQueryKeys,
    type Currency,
    useCurrenciesQuery,
    useCurrency,
} from '@perawallet/wallet-core-currencies'
import { useNetworkStatus, useNetworkStatusStore } from '@modules/network'
import { trackEvent, SettingsEvent, AnalyticsMetadataKey } from '@analytics'

type UseSettingsCurrencyScreenResult = {
    setCurrency: (currency: Currency) => void
    search: string | undefined
    setSearch: (v?: string) => void
    filteredData: Currency[]
    preferredCurrency: string
    fallbackCurrency: string
    /**
     * True when the device is offline AND the selected currency needs a fiat
     * rate we have no cached copy of — i.e. amounts elsewhere in the app
     * cannot be converted yet. The selection itself still applies: the
     * preferred currency is a local persisted value.
     */
    isRateUnavailableOffline: boolean
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
        const { network } = useNetwork()
        const { hasInternet } = useNetworkStatus()
        const queryClient = useQueryClient()

        const isRateUnavailableOffline = useMemo(() => {
            if (hasInternet) return false
            // USD is the identity path in useCurrency, and ALGO rides the
            // DB-backed algo-usd query, which works offline.
            if (preferredCurrency === USD_CURRENCY_ID) return false
            if (isAlgoAssetName(preferredCurrency)) return false

            return !queryClient.getQueryData(
                currencyQueryKeys.price(network, preferredCurrency),
            )
        }, [hasInternet, preferredCurrency, network, queryClient])

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
            if (isAlgoAssetName(currency.id)) {
                setPreferredCurrency(ALGO_ASSET_NAME)
                setFallbackCurrency(USD_CURRENCY_ID)
            } else {
                setPreferredCurrency(currency.id)
                setFallbackCurrency(ALGO_ASSET_NAME)
            }
            // Read connectivity at press time, not from render state.
            // Offline this would only queue refetches that cannot run.
            if (useNetworkStatusStore.getState().hasInternet) {
                invalidateAssetPrices()
            }
        }

        return {
            setCurrency,
            search,
            setSearch,
            filteredData,
            preferredCurrency,
            fallbackCurrency,
            isRateUnavailableOffline,
        }
    }

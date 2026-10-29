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
import { LEGACY_CHAIN_ID } from '@perawallet/wallet-core-chain-contract'
import {
    useWalletDeployment,
    useSelectedScope,
} from '@perawallet/wallet-core-chain-shared'
import {
    ALGO_ASSET_NAME,
    isIntegrityRequiredError,
    type Optional,
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
    search: Optional<string>
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
    isOffline: boolean
    isIntegrityBlocked: boolean
    isError: boolean
    refetch: () => void
}

export const useSettingsCurrencyScreen =
    (): UseSettingsCurrencyScreenResult => {
        const scope = useSelectedScope(LEGACY_CHAIN_ID)
        const deployment = useWalletDeployment()
        const { setCurrencyPreference, fallbackCurrency, preferredCurrency } =
            useCurrency(scope)
        const [search, setSearch] = useState<string>()
        const [filteredData, setFilteredData] = useState<Currency[]>([])

        const { data, isPaused, isError, error, refetch } = useCurrenciesQuery()
        const { invalidateAssetPrices } = useInvalidateAssetPrices()
        const { hasInternet } = useNetworkStatus()
        const queryClient = useQueryClient()

        // docs/OFFLINE_PAUSED_STATE.md: an error while offline is the offline
        // state, not a fault to retry.
        const isOffline = isPaused || (isError && !hasInternet)
        const isIntegrityBlocked = isError && isIntegrityRequiredError(error)

        const isRateUnavailableOffline = useMemo(() => {
            if (hasInternet) return false
            // USD is the identity path in useCurrency.
            if (preferredCurrency === USD_CURRENCY_ID) return false

            return !queryClient.getQueryData(
                currencyQueryKeys.price(deployment, preferredCurrency),
            )
        }, [hasInternet, preferredCurrency, deployment, queryClient])

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
            setCurrencyPreference({
                preferredCurrency: currency.id,
                fallbackCurrency: ALGO_ASSET_NAME,
            })
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
            isOffline,
            isIntegrityBlocked,
            isError,
            refetch: () => void refetch(),
        }
    }

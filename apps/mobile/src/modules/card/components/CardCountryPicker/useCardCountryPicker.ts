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

import { useCallback, useMemo, useState } from 'react'
import {
    useRegistrationSettingsQuery,
    type SupportedCountry,
} from '@perawallet/wallet-core-card'
import { useBottomSheetResult } from '@modules/bottom-sheet'

export type UseCardCountryPickerResult = {
    search: string
    setSearch: (value: string) => void
    countries: SupportedCountry[]
    isLoading: boolean
    isError: boolean
    refetch: () => void
    handleSelect: (country: SupportedCountry) => void
}

/**
 * Drives the country-picker sheet: all countries (eligibility is decided by the
 * caller via `canSignUp`, so unsupported ones stay selectable for the waitlist),
 * name search, and resolving the chosen country back to the caller.
 */
export const useCardCountryPicker = (): UseCardCountryPickerResult => {
    const { data, isLoading, isError, refetch } = useRegistrationSettingsQuery()
    const { resolve } = useBottomSheetResult<SupportedCountry>()
    const [search, setSearch] = useState('')

    const countries = useMemo(() => {
        // Copy before sorting — sorting in place would mutate the query cache.
        const available = [...(data?.countries ?? [])].sort((first, second) =>
            first.name.localeCompare(second.name),
        )

        const query = search.trim().toLowerCase()
        return query
            ? available.filter(country =>
                  country.name.toLowerCase().includes(query),
              )
            : available
    }, [data, search])

    const handleSelect = useCallback(
        (country: SupportedCountry) => resolve(country),
        [resolve],
    )

    const handleRefetch = useCallback(() => {
        void refetch()
    }, [refetch])

    return {
        search,
        setSearch,
        countries,
        isLoading,
        isError,
        refetch: handleRefetch,
        handleSelect,
    }
}

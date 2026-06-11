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

import { useCallback, useMemo, useState } from 'react'
import {
    useRegistrationSettingsQuery,
    type SupportedUsState,
} from '@perawallet/wallet-core-card'
import { useBottomSheetResult } from '@modules/bottom-sheet'

export type UseCardUsStatePickerResult = {
    search: string
    setSearch: (value: string) => void
    states: SupportedUsState[]
    isLoading: boolean
    isError: boolean
    refetch: () => void
    handleSelect: (state: SupportedUsState) => void
}

/**
 * Drives the US-state picker sheet: signup-eligible states from
 * `GET /v1/auth/settings` (states have no waitlist flow, so `canSignUp: false`
 * ones are hidden), name search, and resolving the chosen state back to the
 * caller.
 */
export const useCardUsStatePicker = (): UseCardUsStatePickerResult => {
    const { data, isLoading, isError, refetch } = useRegistrationSettingsQuery()
    const { resolve } = useBottomSheetResult<SupportedUsState>()
    const [search, setSearch] = useState('')

    const states = useMemo(() => {
        const available = (data?.usStates ?? [])
            .filter(state => state.canSignUp)
            .sort((first, second) => first.name.localeCompare(second.name))

        const query = search.trim().toLowerCase()
        return query
            ? available.filter(state =>
                  state.name.toLowerCase().includes(query),
              )
            : available
    }, [data, search])

    const handleSelect = useCallback(
        (state: SupportedUsState) => resolve(state),
        [resolve],
    )

    const handleRefetch = useCallback(() => {
        void refetch()
    }, [refetch])

    return {
        search,
        setSearch,
        states,
        isLoading,
        isError,
        refetch: handleRefetch,
        handleSelect,
    }
}

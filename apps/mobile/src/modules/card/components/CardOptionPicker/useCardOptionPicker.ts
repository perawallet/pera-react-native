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
    type RegistrationOption,
    type RegistrationOptionList,
} from '@perawallet/wallet-core-card'
import { useBottomSheetResult } from '@modules/bottom-sheet'
import { useCardScope } from '../../hooks/useCardScope'

export type UseCardOptionPickerResult = {
    search: string
    setSearch: (value: string) => void
    options: RegistrationOption[]
    isLoading: boolean
    isError: boolean
    refetch: () => void
    handleSelect: (option: RegistrationOption) => void
}

/**
 * Drives a picker sheet over one of the `{ key, name }` lists from
 * `GET /v1/auth/settings`, in Baanx's order, searchable by name, resolving
 * the chosen option back to the caller.
 */
export const useCardOptionPicker = (
    list: RegistrationOptionList,
): UseCardOptionPickerResult => {
    const scope = useCardScope()
    const { data, isLoading, isError, refetch } =
        useRegistrationSettingsQuery(scope)
    const { resolve } = useBottomSheetResult<RegistrationOption>()
    const [search, setSearch] = useState('')

    const options = useMemo(() => {
        const all = data?.[list] ?? []
        const query = search.trim().toLowerCase()
        return query
            ? all.filter(option => option.name.toLowerCase().includes(query))
            : all
    }, [data, list, search])

    const handleSelect = useCallback(
        (option: RegistrationOption) => resolve(option),
        [resolve],
    )

    const handleRefetch = useCallback(() => {
        void refetch()
    }, [refetch])

    return {
        search,
        setSearch,
        options,
        isLoading,
        isError,
        refetch: handleRefetch,
        handleSelect,
    }
}

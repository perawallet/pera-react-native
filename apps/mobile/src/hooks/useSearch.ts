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

import { useState, useMemo, useCallback } from 'react'

/**
 * A hook for filtering a list of items based on a search term.
 *
 * @template T The type of items in the list
 * @param items The array of items to filter
 * @param filterFn Logic to determine if an item matches the search term
 * @returns Filtered items, current search term, and search management methods
 *
 * @example
 * const { filteredItems, searchTerm, setSearchTerm } = useSearch(accounts, (account, term) =>
 *   account.name.toLowerCase().includes(term.toLowerCase())
 * )
 */
export function useSearch<T>(
    items: T[],
    filterFn: (item: T, searchTerm: string) => boolean,
): {
    searchTerm: string
    setSearchTerm: (term: string) => void
    filteredItems: T[]
    clearSearch: () => void
} {
    const [searchTerm, setSearchTerm] = useState('')

    const filteredItems = useMemo(() => {
        if (!searchTerm.trim()) {
            return items
        }
        return items.filter(item => filterFn(item, searchTerm))
    }, [items, searchTerm, filterFn])

    const clearSearch = useCallback(() => {
        setSearchTerm('')
    }, [])

    return {
        searchTerm,
        setSearchTerm,
        filteredItems,
        clearSearch,
    }
}

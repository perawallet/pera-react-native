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

import { renderHook, act } from '@testing-library/react-native'
import { useSearch } from '../search'

describe('useSearch', () => {
    const items = ['apple', 'banana', 'cherry']
    const filterFn = (item: string, searchTerm: string) =>
        item.toLowerCase().includes(searchTerm.toLowerCase())

    it('should return all items when search term is empty', () => {
        const { result } = renderHook(() => useSearch(items, filterFn))
        expect(result.current.filteredItems).toEqual(items)
    })

    it('should filter items based on search term', () => {
        const { result } = renderHook(() => useSearch(items, filterFn))
        act(() => {
            result.current.setSearchTerm('ap')
        })
        expect(result.current.filteredItems).toEqual(['apple'])
    })

    it('should be case-insensitive if filterFn handles it', () => {
        const { result } = renderHook(() => useSearch(items, filterFn))
        act(() => {
            result.current.setSearchTerm('BAN')
        })
        expect(result.current.filteredItems).toEqual(['banana'])
    })

    it('should clear search term', () => {
        const { result } = renderHook(() => useSearch(items, filterFn))
        act(() => {
            result.current.setSearchTerm('apple')
        })
        expect(result.current.filteredItems).toEqual(['apple'])

        act(() => {
            result.current.clearSearch()
        })
        expect(result.current.searchTerm).toBe('')
        expect(result.current.filteredItems).toEqual(items)
    })
})

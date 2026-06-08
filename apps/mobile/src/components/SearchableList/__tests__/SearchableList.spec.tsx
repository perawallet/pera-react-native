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

import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@test-utils/render'
import { SearchableList } from '../SearchableList'

type Item = {
    id: string
    label: string
}

const items: Item[] = [{ id: '1', label: 'First item' }]

describe('SearchableList', () => {
    it('renders the default search input', () => {
        render(
            <SearchableList
                data={items}
                keyExtractor={item => item.id}
                renderItem={({ item }) => item.label}
                searchPlaceholder='Search items'
            />,
        )

        // The search renders twice (sticky display mirror + focusable overlay).
        expect(screen.getAllByPlaceholderText('Search items')[0]).toBeTruthy()
        expect(screen.getByText('First item')).toBeTruthy()
    })

    it('renders a custom search input', () => {
        const onSearchChange = vi.fn()

        render(
            <SearchableList
                data={items}
                keyExtractor={item => item.id}
                renderItem={({ item }) => item.label}
                searchValue='first'
                searchPlaceholder='Find item'
                onSearchChange={onSearchChange}
                SearchInputComponent={({
                    value,
                    placeholder,
                    onChangeText,
                    onFocus,
                }) => (
                    <input
                        aria-label='custom-search'
                        value={value}
                        placeholder={placeholder}
                        onChange={event => onChangeText?.(event.target.value)}
                        onFocus={onFocus}
                    />
                )}
            />,
        )

        // Rendered twice (display mirror + overlay); the overlay (last) is the
        // interactive one whose changes drive onSearchChange.
        const inputs = screen.getAllByLabelText('custom-search')
        const overlayInput = inputs[inputs.length - 1] as HTMLInputElement

        expect(overlayInput.value).toBe('first')

        fireEvent.change(overlayInput, { target: { value: 'second' } })

        expect(onSearchChange).toHaveBeenCalledWith('second')
    })

    it('renders the empty component when user data is empty', () => {
        render(
            <SearchableList
                data={[]}
                keyExtractor={item => item.id}
                renderItem={({ item }: { item: Item }) => item.label}
                searchPlaceholder='Search items'
                ListEmptyComponent={<span>No items</span>}
            />,
        )

        expect(screen.getAllByPlaceholderText('Search items')[0]).toBeTruthy()
        expect(screen.getByText('No items')).toBeTruthy()
    })
})

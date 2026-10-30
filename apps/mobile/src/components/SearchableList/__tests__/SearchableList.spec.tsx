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

import { describe, expect, it, vi, type Mock } from 'vitest'
import { View } from 'react-native'
import { act, fireEvent, render, screen } from '@test-utils/render'
import { PWText } from '@components/core'
import { SearchableList } from '../SearchableList'

// The shared FlashList mock drops onScroll; this one keeps what it renders and
// hands the scroll handler to the test.
type MockListProps = {
    data?: unknown[]
    renderItem: (info: { item: unknown; index: number }) => React.ReactNode
    keyExtractor?: (item: unknown, index: number) => string
    onScroll?: (event: unknown) => void
    ListHeaderComponent?: unknown
    ListFooterComponent?: unknown
    ListEmptyComponent?: unknown
}

const flashList = vi.hoisted(() => ({
    onScroll: undefined as ((event: unknown) => void) | undefined,
}))
vi.mock('@shopify/flash-list', async () => {
    const React = await import('react')
    const toNode = (component: unknown) =>
        React.isValidElement(component)
            ? component
            : typeof component === 'function'
              ? React.createElement(component as React.ComponentType)
              : null
    return {
        FlashList: ({
            data,
            renderItem,
            keyExtractor,
            onScroll,
            ListHeaderComponent,
            ListFooterComponent,
            ListEmptyComponent,
        }: MockListProps) => {
            flashList.onScroll = onScroll
            return React.createElement(
                'div',
                null,
                toNode(ListHeaderComponent),
                data && data.length > 0
                    ? data.map((item, index) =>
                          React.createElement(
                              React.Fragment,
                              { key: keyExtractor?.(item, index) ?? index },
                              renderItem({ item, index }),
                          ),
                      )
                    : toNode(ListEmptyComponent),
                toNode(ListFooterComponent),
            )
        },
    }
})

type LayoutProps = {
    onLayout?: (event: unknown) => void
    children?: unknown
}

// Unit tests stub View as a plain div that never attaches onLayout, so the
// handlers are read back from the props View was rendered with.
const layoutProps = (): LayoutProps[] =>
    (View as unknown as Mock).mock.calls
        .map(([props]) => props as LayoutProps)
        .filter(props => props.onLayout != null)

const fireLayout = (props: LayoutProps | undefined, height: number) =>
    act(() => props?.onLayout?.({ nativeEvent: { layout: { height } } }))

const scrollTo = (y: number) =>
    act(() =>
        flashList.onScroll?.({
            nativeEvent: {
                contentOffset: { y },
                contentSize: { height: 12_000 },
                layoutMeasurement: { height: 600 },
            },
        }),
    )

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

    it('renders the search accessory under the search input', () => {
        render(
            <SearchableList
                data={items}
                keyExtractor={item => item.id}
                renderItem={({ item }) => item.label}
                searchAccessory={<PWText>Chips</PWText>}
            />,
        )

        expect(screen.getByText('Chips')).toBeTruthy()
    })

    it('keeps the search accessory over an empty list', () => {
        render(
            <SearchableList
                data={[] as Item[]}
                keyExtractor={item => item.id}
                renderItem={({ item }) => item.label}
                searchAccessory={<PWText>Chips</PWText>}
                ListEmptyComponent={<PWText>Nothing here</PWText>}
            />,
        )

        expect(screen.getByText('Chips')).toBeTruthy()
        expect(screen.getByText('Nothing here')).toBeTruthy()
    })

    it('draws a divider under the pinned search bar only while rows scroll beneath it', () => {
        const header = <PWText>Header</PWText>
        render(
            <SearchableList
                data={items}
                keyExtractor={item => item.id}
                renderItem={({ item }) => item.label}
                ListHeaderComponent={header}
                searchAccessory={<PWText>Chips</PWText>}
            />,
        )
        fireLayout(
            layoutProps().findLast(p => p.children === header),
            320,
        )
        fireLayout(
            layoutProps().findLast(p => p.children !== header),
            120,
        )
        expect(
            screen.queryByTestId('searchable-list-search-divider'),
        ).toBeNull()

        scrollTo(360)
        expect(
            screen.getByTestId('searchable-list-search-divider'),
        ).toBeTruthy()

        scrollTo(0)
        expect(
            screen.queryByTestId('searchable-list-search-divider'),
        ).toBeNull()
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

describe('SearchableList in bottom sheet', () => {
    const DATA = [
        { id: 'a', label: 'Apple' },
        { id: 'b', label: 'Banana' },
    ]
    const renderRow = ({ item }: { item: (typeof DATA)[number] }) => (
        <PWText>{item.label}</PWText>
    )

    it('renders rows and a working search input in sheet mode', () => {
        const onSearchChange = vi.fn()
        render(
            <SearchableList
                inBottomSheet
                data={DATA}
                keyExtractor={item => item.id}
                renderItem={renderRow}
                searchValue=''
                searchPlaceholder='Search assets'
                onSearchChange={onSearchChange}
            />,
        )

        expect(screen.getByText('Apple')).toBeTruthy()
        expect(screen.getByText('Banana')).toBeTruthy()

        fireEvent.change(screen.getByTestId('searchable-list-search-input'), {
            target: { value: 'app' },
        })
        expect(onSearchChange).toHaveBeenCalledWith('app')
    })

    it('keeps the search accessory over an empty list in sheet mode', () => {
        render(
            <SearchableList
                inBottomSheet
                data={[] as (typeof DATA)[number][]}
                keyExtractor={item => item.id}
                renderItem={renderRow}
                searchAccessory={<PWText>Chips</PWText>}
                ListEmptyComponent={<PWText>No results</PWText>}
            />,
        )

        expect(screen.getByText('Chips')).toBeTruthy()
        expect(screen.getByText('No results')).toBeTruthy()
    })

    it('renders the empty component when data is empty in sheet mode', () => {
        render(
            <SearchableList
                inBottomSheet
                data={[] as (typeof DATA)[number][]}
                keyExtractor={item => item.id}
                renderItem={renderRow}
                searchValue='zzz'
                onSearchChange={vi.fn()}
                ListEmptyComponent={<PWText>No results</PWText>}
            />,
        )
        expect(screen.getByText('No results')).toBeTruthy()
    })
})

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
import { PWText } from '@components/core'
import { AssetSelectionList } from '../AssetSelectionList'

type Row = { id: string; label: string }

const DATA: Row[] = [
    { id: '1', label: 'Algo' },
    { id: '2', label: 'USDC' },
]

const renderRow = ({ item }: { item: Row }) => <PWText>{item.label}</PWText>
const keyExtractor = (item: Row) => item.id

describe('AssetSelectionList', () => {
    it('renders a row per data item', () => {
        render(
            <AssetSelectionList
                data={DATA}
                renderItem={renderRow}
                keyExtractor={keyExtractor}
                searchValue=''
                onSearchChange={vi.fn()}
            />,
        )
        expect(screen.getByText('Algo')).toBeTruthy()
        expect(screen.getByText('USDC')).toBeTruthy()
    })

    it('forwards search input changes', () => {
        const onSearchChange = vi.fn()
        render(
            <AssetSelectionList
                data={DATA}
                renderItem={renderRow}
                keyExtractor={keyExtractor}
                searchValue=''
                onSearchChange={onSearchChange}
                searchPlaceholder='Search'
            />,
        )
        fireEvent.change(screen.getByTestId('searchable-list-search-input'), {
            target: { value: 'usdc' },
        })
        expect(onSearchChange).toHaveBeenCalledWith('usdc')
    })

    it('shows the empty component when not loading and data is empty', () => {
        render(
            <AssetSelectionList
                data={[]}
                renderItem={renderRow}
                keyExtractor={keyExtractor}
                searchValue='zzz'
                onSearchChange={vi.fn()}
                ListEmptyComponent={<PWText>Nothing here</PWText>}
            />,
        )
        expect(screen.getByText('Nothing here')).toBeTruthy()
    })

    it('shows skeletons instead of the empty component while loading', () => {
        render(
            <AssetSelectionList
                data={[]}
                renderItem={renderRow}
                keyExtractor={keyExtractor}
                searchValue=''
                onSearchChange={vi.fn()}
                isLoading
                ListEmptyComponent={<PWText>Nothing here</PWText>}
            />,
        )
        expect(screen.queryByText('Nothing here')).toBeNull()
    })
})

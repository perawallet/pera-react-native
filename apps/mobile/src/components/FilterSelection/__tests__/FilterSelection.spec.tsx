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
import { FilterSelection, type FilterOption } from '../FilterSelection'

type Filter = 'all' | 'fiat' | 'crypto'

const OPTIONS: FilterOption<Filter>[] = [
    { value: 'all', label: 'All', testID: 'filter-all' },
    { value: 'fiat', label: 'Fiat', testID: 'filter-fiat' },
    { value: 'crypto', label: 'Crypto', testID: 'filter-crypto' },
]

describe('FilterSelection', () => {
    it('renders a chip per option', () => {
        render(
            <FilterSelection
                options={OPTIONS}
                selectedValue='all'
                onSelect={vi.fn()}
            />,
        )

        expect(screen.getByText('All')).toBeTruthy()
        expect(screen.getByText('Fiat')).toBeTruthy()
        expect(screen.getByText('Crypto')).toBeTruthy()
    })

    it('calls onSelect with the tapped option value', () => {
        const onSelect = vi.fn()
        render(
            <FilterSelection
                options={OPTIONS}
                selectedValue='all'
                onSelect={onSelect}
            />,
        )

        fireEvent.click(screen.getByTestId('filter-fiat'))

        expect(onSelect).toHaveBeenCalledWith('fiat')
    })

    it('supports a null option value (e.g. an "all" filter)', () => {
        const onSelect = vi.fn()
        const options: FilterOption<string | null>[] = [
            { value: null, label: 'All', testID: 'filter-null' },
            { value: 'pending', label: 'Pending', testID: 'filter-pending' },
        ]
        render(
            <FilterSelection
                options={options}
                selectedValue={null}
                onSelect={onSelect}
            />,
        )

        fireEvent.click(screen.getByTestId('filter-pending'))
        expect(onSelect).toHaveBeenCalledWith('pending')
    })
})

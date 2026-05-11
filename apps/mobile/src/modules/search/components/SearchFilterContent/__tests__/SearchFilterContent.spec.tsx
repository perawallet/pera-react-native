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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@test-utils/render'
import {
    BottomSheetIdContext,
    useBottomSheetStore,
} from '@modules/bottom-sheet'
import { SearchFilterContent } from '../SearchFilterContent'

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: (key: string) => key }),
}))

const renderWithId = (
    onToggleScope = vi.fn(),
    scopes: Array<'accounts' | 'contacts' | 'assets'> = [
        'accounts',
        'contacts',
        'assets',
    ],
    id = 'sheet-1',
) =>
    render(
        <BottomSheetIdContext.Provider value={id}>
            <SearchFilterContent
                scopes={scopes}
                onToggleScope={onToggleScope}
            />
        </BottomSheetIdContext.Provider>,
    )

describe('SearchFilterContent', () => {
    beforeEach(() => {
        useBottomSheetStore.getState().resetState()
        vi.clearAllMocks()
    })

    it('renders all three scope labels', () => {
        renderWithId()
        expect(screen.getByText('search.filter.accounts')).toBeTruthy()
        expect(screen.getByText('search.filter.contacts')).toBeTruthy()
        expect(screen.getByText('search.filter.assets')).toBeTruthy()
    })

    it('calls onToggleScope when a toggle is flipped', () => {
        const onToggle = vi.fn()
        renderWithId(onToggle)

        fireEvent.click(screen.getByTestId('search_filter_toggle_assets'))
        expect(onToggle).toHaveBeenCalledWith('assets')
    })
})

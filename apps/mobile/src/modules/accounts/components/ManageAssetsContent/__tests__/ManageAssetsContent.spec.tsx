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

import React from 'react'
import { render, screen, fireEvent } from '@test-utils/render'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
    BottomSheetIdContext,
    useBottomSheetStore,
} from '@modules/bottom-sheet'
import { ManageAssetsContent } from '../ManageAssetsContent'

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({
        t: (key: string) => key,
    }),
}))

const renderWithId = (
    id = 'sheet-1',
    props: Partial<React.ComponentProps<typeof ManageAssetsContent>> = {},
) =>
    render(
        <BottomSheetIdContext.Provider value={id}>
            <ManageAssetsContent
                isWatchAccount={false}
                {...props}
            />
        </BottomSheetIdContext.Provider>,
    )

describe('ManageAssetsContent', () => {
    beforeEach(() => {
        useBottomSheetStore.getState().resetState()
        vi.clearAllMocks()
    })

    it('renders sort, filter, and remove options for non-watch accounts', () => {
        renderWithId()
        expect(screen.getByTestId('manage_assets_sort')).toBeTruthy()
        expect(screen.getByTestId('manage_assets_filter')).toBeTruthy()
        expect(screen.getByTestId('manage_assets_remove')).toBeTruthy()
    })

    it('hides remove option for watch accounts', () => {
        renderWithId('sheet-1', { isWatchAccount: true })
        expect(screen.queryByTestId('manage_assets_remove')).toBeNull()
    })

    it('resolves with "sort" when sort option is pressed', async () => {
        const promise = useBottomSheetStore
            .getState()
            .request<'sort' | 'filter' | 'remove'>({
                id: 'sheet-1',
                contents: null,
            })
        renderWithId('sheet-1')

        fireEvent.click(screen.getByTestId('manage_assets_sort'))
        useBottomSheetStore.getState().remove('sheet-1')

        await expect(promise).resolves.toBe('sort')
    })

    it('resolves with "filter" when filter option is pressed', async () => {
        const promise = useBottomSheetStore
            .getState()
            .request<'sort' | 'filter' | 'remove'>({
                id: 'sheet-1',
                contents: null,
            })
        renderWithId('sheet-1')

        fireEvent.click(screen.getByTestId('manage_assets_filter'))
        useBottomSheetStore.getState().remove('sheet-1')

        await expect(promise).resolves.toBe('filter')
    })

    it('resolves with "remove" when remove option is pressed', async () => {
        const promise = useBottomSheetStore
            .getState()
            .request<'sort' | 'filter' | 'remove'>({
                id: 'sheet-1',
                contents: null,
            })
        renderWithId('sheet-1')

        fireEvent.click(screen.getByTestId('manage_assets_remove'))
        useBottomSheetStore.getState().remove('sheet-1')

        await expect(promise).resolves.toBe('remove')
    })
})

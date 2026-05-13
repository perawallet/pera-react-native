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
import { render, screen } from '@test-utils/render'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
    BottomSheetIdContext,
    useBottomSheetStore,
} from '@modules/bottom-sheet'
import { AccountMenuContent } from '../AccountMenuContent'

vi.mock('@components/core', () => ({
    PWToolbar: ({
        left,
        right,
    }: {
        left?: React.ReactNode
        right?: React.ReactNode
    }) => (
        <div data-testid='PWToolbar'>
            {left}
            {right}
        </div>
    ),
    PWIcon: ({ name, onPress }: { name: string; onPress: () => void }) => (
        <button
            data-testid={`icon-${name}`}
            onClick={onPress}
        />
    ),
}))

vi.mock('@modules/accounts/components/AccountMenu', () => ({
    AccountMenu: () => <div data-testid='AccountMenu' />,
}))

const renderWithId = (
    id = 'sheet-1',
    props: Partial<React.ComponentProps<typeof AccountMenuContent>> = {},
) =>
    render(
        <BottomSheetIdContext.Provider value={id}>
            <AccountMenuContent {...props} />
        </BottomSheetIdContext.Provider>,
    )

describe('AccountMenuContent', () => {
    beforeEach(() => {
        useBottomSheetStore.getState().resetState()
        vi.clearAllMocks()
    })

    it('renders the toolbar and the account menu', () => {
        renderWithId()
        expect(screen.getByTestId('PWToolbar')).toBeTruthy()
        expect(screen.getByTestId('AccountMenu')).toBeTruthy()
    })

    it('renders a search icon when showSearch is true', () => {
        renderWithId('sheet-1', { showSearch: true })
        expect(screen.getByTestId('icon-magnifying-glass')).toBeTruthy()
    })

    it('does not render a search icon by default', () => {
        renderWithId()
        expect(screen.queryByTestId('icon-magnifying-glass')).toBeNull()
    })
})

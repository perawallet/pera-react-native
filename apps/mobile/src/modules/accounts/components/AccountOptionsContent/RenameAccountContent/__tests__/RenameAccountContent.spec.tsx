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

import { render, screen, fireEvent } from '@test-utils/render'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import {
    BottomSheetIdContext,
    useBottomSheetStore,
} from '@modules/bottom-sheet'
import { RenameAccountContent } from '../RenameAccountContent'

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({
        t: (key: string) => key,
    }),
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useAccountsStore: vi.fn(selector =>
        selector({
            accounts: [
                {
                    id: 'AAA',
                    address: 'AAA',
                    name: 'My Account',
                },
            ],
        }),
    ),
}))

const renderWithId = (id = 'sheet-1') =>
    render(
        <BottomSheetIdContext.Provider value={id}>
            <RenameAccountContent accountId='AAA' />
        </BottomSheetIdContext.Provider>,
    )

describe('RenameAccountContent', () => {
    beforeEach(() => {
        useBottomSheetStore.getState().resetState()
        vi.clearAllMocks()
    })

    it('renders title and save button', () => {
        renderWithId()
        expect(screen.getByText('account_options.rename_title')).toBeTruthy()
        expect(screen.getByText('account_options.rename_save')).toBeTruthy()
    })

    it('prefills the input with the live account name', () => {
        renderWithId()
        const input = screen.getByTestId('PWInput')
        expect(input).toHaveProperty('value', 'My Account')
    })

    it('save resolves the caller promise with the trimmed name', async () => {
        const promise = useBottomSheetStore
            .getState()
            .request<string>({ id: 'sheet-1', contents: null })
        renderWithId('sheet-1')

        const input = screen.getByTestId('PWInput')
        fireEvent.change(input, { target: { value: '  New Name  ' } })

        const saveButton = screen.getByText('account_options.rename_save')
        fireEvent.click(saveButton)

        // Two-phase close: resolve marks invisible, then host calls remove.
        // We simulate the post-animation remove here.
        useBottomSheetStore.getState().remove('sheet-1')
        await expect(promise).resolves.toBe('New Name')
    })

    it('save is disabled when the trimmed name is empty', () => {
        renderWithId()
        const input = screen.getByTestId('PWInput')
        fireEvent.change(input, { target: { value: '   ' } })
        const saveButton = screen.getByText('account_options.rename_save')
        expect(saveButton.closest('button')).toHaveProperty('disabled', true)
    })

    it('close icon dismisses (caller promise resolves with undefined)', async () => {
        const promise = useBottomSheetStore
            .getState()
            .request<string>({ id: 'sheet-1', contents: null })
        renderWithId('sheet-1')

        const closeIcon = screen.getByTestId('icon-cross')
        fireEvent.click(closeIcon)

        useBottomSheetStore.getState().remove('sheet-1')
        await expect(promise).resolves.toBeUndefined()
    })
})

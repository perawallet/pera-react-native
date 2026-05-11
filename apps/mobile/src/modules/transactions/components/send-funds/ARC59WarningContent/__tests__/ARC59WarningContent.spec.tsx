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
import React from 'react'
import { render, screen, fireEvent } from '@test-utils/render'
import {
    BottomSheetIdContext,
    useBottomSheetStore,
} from '@modules/bottom-sheet'
import { ARC59WarningContent } from '../ARC59WarningContent'

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({
        t: (key: string) => key,
    }),
}))

const renderWithId = (id = 'sheet-1') =>
    render(
        <BottomSheetIdContext.Provider value={id}>
            <ARC59WarningContent />
        </BottomSheetIdContext.Provider>,
    )

describe('ARC59WarningContent', () => {
    beforeEach(() => {
        useBottomSheetStore.getState().resetState()
        vi.clearAllMocks()
    })

    it('renders title, message, and action buttons', () => {
        renderWithId()

        expect(screen.getByText('send_funds.arc59_warning.title')).toBeTruthy()
        expect(
            screen.getByText('send_funds.arc59_warning.message'),
        ).toBeTruthy()
        expect(
            screen.getByText('send_funds.arc59_warning.confirm'),
        ).toBeTruthy()
        expect(screen.getByText('send_funds.arc59_warning.cancel')).toBeTruthy()
    })

    it("resolves the caller promise with 'confirm' when confirm button is pressed", async () => {
        const promise = useBottomSheetStore
            .getState()
            .request<'confirm'>({ id: 'sheet-1', contents: null })
        renderWithId('sheet-1')

        fireEvent.click(screen.getByText('send_funds.arc59_warning.confirm'))

        useBottomSheetStore.getState().remove('sheet-1')
        await expect(promise).resolves.toBe('confirm')
    })

    it('dismisses (caller promise resolves with undefined) when cancel button is pressed', async () => {
        const promise = useBottomSheetStore
            .getState()
            .request<'confirm'>({ id: 'sheet-1', contents: null })
        renderWithId('sheet-1')

        fireEvent.click(screen.getByText('send_funds.arc59_warning.cancel'))

        useBottomSheetStore.getState().remove('sheet-1')
        await expect(promise).resolves.toBeUndefined()
    })
})

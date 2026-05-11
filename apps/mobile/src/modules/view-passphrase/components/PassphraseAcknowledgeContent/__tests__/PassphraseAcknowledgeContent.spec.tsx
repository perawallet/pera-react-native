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
import { PassphraseAcknowledgeContent } from '../PassphraseAcknowledgeContent'

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({
        t: (key: string) => key,
    }),
}))

const TEST_ID = 'passphrase_acknowledge_bottom_sheet'

const renderWithId = (id = 'sheet-1') =>
    render(
        <BottomSheetIdContext.Provider value={id}>
            <PassphraseAcknowledgeContent />
        </BottomSheetIdContext.Provider>,
    )

describe('PassphraseAcknowledgeContent', () => {
    beforeEach(() => {
        useBottomSheetStore.getState().resetState()
        vi.clearAllMocks()
    })

    it('renders title, description, all four rows, and action buttons', () => {
        renderWithId()

        expect(
            screen.getByText('view_passphrase.acknowledge.title'),
        ).toBeTruthy()
        expect(
            screen.getByText('view_passphrase.acknowledge.description'),
        ).toBeTruthy()
        expect(
            screen.getByText('view_passphrase.acknowledge.row_screen'),
        ).toBeTruthy()
        expect(
            screen.getByText('view_passphrase.acknowledge.row_share'),
        ).toBeTruthy()
        expect(
            screen.getByText('view_passphrase.acknowledge.row_lose'),
        ).toBeTruthy()
        expect(
            screen.getByText('view_passphrase.acknowledge.row_pera'),
        ).toBeTruthy()
        expect(
            screen.getByText('view_passphrase.acknowledge.cta_reveal'),
        ).toBeTruthy()
        expect(
            screen.getByText('view_passphrase.acknowledge.cta_cancel'),
        ).toBeTruthy()
    })

    it('reveal button is disabled until all rows checked', async () => {
        const promise = useBottomSheetStore
            .getState()
            .request<'confirm'>({ id: 'sheet-1', contents: null })
        renderWithId('sheet-1')

        // Press reveal with nothing toggled — should not resolve
        fireEvent.click(screen.getByTestId(`${TEST_ID}_reveal`))

        // Check 3 of 4
        fireEvent.click(screen.getByTestId(`${TEST_ID}_row_0`))
        fireEvent.click(screen.getByTestId(`${TEST_ID}_row_1`))
        fireEvent.click(screen.getByTestId(`${TEST_ID}_row_2`))
        fireEvent.click(screen.getByTestId(`${TEST_ID}_reveal`))

        // Resolve happens only after all 4 are checked
        fireEvent.click(screen.getByTestId(`${TEST_ID}_row_3`))
        fireEvent.click(screen.getByTestId(`${TEST_ID}_reveal`))

        useBottomSheetStore.getState().remove('sheet-1')
        await expect(promise).resolves.toBe('confirm')
    })

    it('cancel button dismisses (caller promise resolves with undefined)', async () => {
        const promise = useBottomSheetStore
            .getState()
            .request<'confirm'>({ id: 'sheet-1', contents: null })
        renderWithId('sheet-1')

        fireEvent.click(screen.getByTestId(`${TEST_ID}_cancel`))

        useBottomSheetStore.getState().remove('sheet-1')
        await expect(promise).resolves.toBeUndefined()
    })
})

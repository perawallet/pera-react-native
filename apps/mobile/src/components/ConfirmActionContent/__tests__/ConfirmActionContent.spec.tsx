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

import React from 'react'
import { fireEvent, render, screen } from '@test-utils/render'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
    BottomSheetIdContext,
    useBottomSheetStore,
} from '@modules/bottom-sheet'
import { PWText } from '@components/core'
import { ConfirmActionContent } from '../ConfirmActionContent'

const baseProps = {
    title: 'Delete contact',
    message: 'Are you sure you want to delete this contact?',
    confirmLabel: 'Yes, delete contact',
    cancelLabel: 'Keep it',
}

const renderWithId = (id = 'sheet-1') =>
    render(
        <BottomSheetIdContext.Provider value={id}>
            <ConfirmActionContent {...baseProps} />
        </BottomSheetIdContext.Provider>,
    )

describe('ConfirmActionContent', () => {
    beforeEach(() => {
        useBottomSheetStore.getState().resetState()
        useBottomSheetStore.getState().registerBottomSheetHost()
        vi.clearAllMocks()
    })

    it('renders the title, message and actions', () => {
        renderWithId()
        expect(screen.getByText(baseProps.title)).toBeTruthy()
        expect(screen.getByText(baseProps.message)).toBeTruthy()
        expect(screen.getByText(baseProps.confirmLabel)).toBeTruthy()
        expect(screen.getByText(baseProps.cancelLabel)).toBeTruthy()
    })

    it('resolves the caller promise with true when the confirm button is pressed', async () => {
        const promise = useBottomSheetStore
            .getState()
            .request<boolean>({ id: 'sheet-1', contents: null })
        renderWithId('sheet-1')

        fireEvent.click(screen.getByText(baseProps.confirmLabel))

        useBottomSheetStore.getState().remove('sheet-1')
        await expect(promise).resolves.toBe(true)
    })

    it('dismisses (resolves with undefined) when the cancel button is pressed', async () => {
        const promise = useBottomSheetStore
            .getState()
            .request<boolean>({ id: 'sheet-1', contents: null })
        renderWithId('sheet-1')

        fireEvent.click(screen.getByText(baseProps.cancelLabel))

        useBottomSheetStore.getState().remove('sheet-1')
        await expect(promise).resolves.toBeUndefined()
    })

    it('resolves the caller promise with the tertiary value when the tertiary button is pressed', async () => {
        const promise = useBottomSheetStore
            .getState()
            .request<string>({ id: 'sheet-1', contents: null })
        render(
            <BottomSheetIdContext.Provider value='sheet-1'>
                <ConfirmActionContent<string>
                    {...baseProps}
                    tertiaryLabel='Delete forever'
                    tertiaryValue='delete'
                />
            </BottomSheetIdContext.Provider>,
        )

        fireEvent.click(screen.getByText('Delete forever'))

        useBottomSheetStore.getState().remove('sheet-1')
        await expect(promise).resolves.toBe('delete')
    })

    it('renders the source image instead of the vector icon when iconUrl is set', () => {
        render(
            <BottomSheetIdContext.Provider value='sheet-1'>
                <ConfirmActionContent
                    {...baseProps}
                    testID='confirm'
                    icon='check'
                    iconUrl='https://dapp.example.org/logo.png'
                />
            </BottomSheetIdContext.Provider>,
        )
        expect(screen.getByTestId('confirm-icon-image')).toBeTruthy()
    })

    it('renders a ReactNode message', () => {
        render(
            <BottomSheetIdContext.Provider value='sheet-1'>
                <ConfirmActionContent
                    {...baseProps}
                    message={
                        <>
                            <PWText>Line one</PWText>
                            <PWText>Line two</PWText>
                        </>
                    }
                />
            </BottomSheetIdContext.Provider>,
        )
        expect(screen.getByText('Line one')).toBeTruthy()
        expect(screen.getByText('Line two')).toBeTruthy()
    })
})

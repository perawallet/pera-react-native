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
import { fireEvent, render, screen } from '@test-utils/render'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { PWText } from '@components/core'
import { BottomSheetIdContext } from '../../BottomSheetHost/BottomSheetIdContext'
import { useBottomSheetStore } from '../../../store/bottomSheetStore'
import { SheetHeader } from '../SheetHeader'

const renderWithId = (ui: React.ReactNode, id = 'sheet-1') =>
    render(
        <BottomSheetIdContext.Provider value={id}>
            {ui}
        </BottomSheetIdContext.Provider>,
    )

describe('SheetHeader', () => {
    beforeEach(() => {
        useBottomSheetStore.getState().resetState()
        vi.clearAllMocks()
    })

    it('renders the title', () => {
        renderWithId(<SheetHeader title='My sheet' />)
        expect(screen.getByText('My sheet')).toBeTruthy()
    })

    it('renders a ReactNode title verbatim', () => {
        renderWithId(<SheetHeader title={<PWText>Custom</PWText>} />)
        expect(screen.getByText('Custom')).toBeTruthy()
    })

    it('renders the right action', () => {
        renderWithId(
            <SheetHeader
                title='With action'
                rightAction={<PWText>Done</PWText>}
            />,
        )
        expect(screen.getByText('Done')).toBeTruthy()
    })

    it('dismisses the host sheet when the close icon is pressed', async () => {
        const promise = useBottomSheetStore
            .getState()
            .request({ id: 'sheet-1', contents: null })
        renderWithId(
            <SheetHeader
                title='Closeable'
                testID='hdr'
            />,
            'sheet-1',
        )

        fireEvent.click(screen.getByTestId('hdr-close'))

        useBottomSheetStore.getState().remove('sheet-1')
        await expect(promise).resolves.toBeUndefined()
    })

    it('invokes the custom onClose handler if provided', () => {
        const onClose = vi.fn()
        renderWithId(
            <SheetHeader
                title='Custom close'
                onClose={onClose}
                testID='hdr'
            />,
        )

        fireEvent.click(screen.getByTestId('hdr-close'))

        expect(onClose).toHaveBeenCalledTimes(1)
    })
})

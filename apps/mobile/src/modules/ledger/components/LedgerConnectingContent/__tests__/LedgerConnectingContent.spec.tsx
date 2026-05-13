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
import { LedgerConnectingContent } from '../LedgerConnectingContent'

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: (key: string) => key }),
}))

const renderWithId = (id = 'sheet-1') =>
    render(
        <BottomSheetIdContext.Provider value={id}>
            <LedgerConnectingContent />
        </BottomSheetIdContext.Provider>,
    )

describe('LedgerConnectingContent', () => {
    beforeEach(() => {
        useBottomSheetStore.getState().resetState()
        vi.clearAllMocks()
    })

    it('renders the title and subtitle', () => {
        renderWithId()

        expect(screen.getByText('ledger.connecting.title')).toBeTruthy()
        expect(screen.getByText('ledger.connecting.subtitle')).toBeTruthy()
    })

    it('resolves the caller promise with "cancel" when Cancel is pressed', async () => {
        const promise = useBottomSheetStore
            .getState()
            .request<'cancel'>({ id: 'sheet-1', contents: null })
        renderWithId('sheet-1')

        fireEvent.click(screen.getByText('ledger.connecting.cancel'))

        useBottomSheetStore.getState().remove('sheet-1')
        await expect(promise).resolves.toBe('cancel')
    })
})

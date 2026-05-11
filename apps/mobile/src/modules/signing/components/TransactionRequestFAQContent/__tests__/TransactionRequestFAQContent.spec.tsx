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

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@test-utils/render'
import {
    BottomSheetIdContext,
    useBottomSheetStore,
} from '@modules/bottom-sheet'
import { TransactionRequestFAQContent } from '../TransactionRequestFAQContent'

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({
        t: (key: string) => key,
    }),
}))

const renderWithId = (id = 'sheet-1') =>
    render(
        <BottomSheetIdContext.Provider value={id}>
            <TransactionRequestFAQContent />
        </BottomSheetIdContext.Provider>,
    )

describe('TransactionRequestFAQContent', () => {
    beforeEach(() => {
        useBottomSheetStore.getState().resetState()
    })

    it('renders title and close button', () => {
        renderWithId()
        expect(
            screen.getByText('signing.transaction_request_faq.title'),
        ).toBeTruthy()
        expect(screen.getByText('common.close.label')).toBeTruthy()
    })

    it('close dismisses (caller promise resolves with undefined)', async () => {
        const promise = useBottomSheetStore
            .getState()
            .request<void>({ id: 'sheet-1', contents: null })
        renderWithId('sheet-1')

        const closeButton = screen.getByText('common.close.label')
        fireEvent.click(closeButton)

        useBottomSheetStore.getState().remove('sheet-1')
        await expect(promise).resolves.toBeUndefined()
    })
})

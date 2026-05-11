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
import { render, fireEvent, screen } from '@test-utils/render'
import {
    BottomSheetIdContext,
    useBottomSheetStore,
} from '@modules/bottom-sheet'
import { ImportAccountSupportOptionsContent } from '../ImportAccountSupportOptionsContent'

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
    }),
}))

type Result = 'paste' | 'scan' | 'learn-more'

const renderWithId = (id = 'sheet-1') =>
    render(
        <BottomSheetIdContext.Provider value={id}>
            <ImportAccountSupportOptionsContent />
        </BottomSheetIdContext.Provider>,
    )

describe('ImportAccountSupportOptionsContent', () => {
    beforeEach(() => {
        useBottomSheetStore.getState().resetState()
        vi.clearAllMocks()
    })

    it('renders title and all options', () => {
        renderWithId()
        expect(
            screen.getByText('onboarding.import_account.support_options.title'),
        ).toBeTruthy()
        expect(
            screen.getByText(
                'onboarding.import_account.support_options.paste_passphrase',
            ),
        ).toBeTruthy()
        expect(
            screen.getByText(
                'onboarding.import_account.support_options.scan_qr',
            ),
        ).toBeTruthy()
        expect(
            screen.getByText(
                'onboarding.import_account.support_options.learn_more',
            ),
        ).toBeTruthy()
    })

    it("paste option resolves with 'paste'", async () => {
        const promise = useBottomSheetStore
            .getState()
            .request<Result>({ id: 'sheet-1', contents: null })
        renderWithId('sheet-1')

        fireEvent.click(
            screen.getByText(
                'onboarding.import_account.support_options.paste_passphrase',
            ),
        )
        useBottomSheetStore.getState().remove('sheet-1')
        await expect(promise).resolves.toBe('paste')
    })

    it("scan option resolves with 'scan'", async () => {
        const promise = useBottomSheetStore
            .getState()
            .request<Result>({ id: 'sheet-1', contents: null })
        renderWithId('sheet-1')

        fireEvent.click(
            screen.getByText(
                'onboarding.import_account.support_options.scan_qr',
            ),
        )
        useBottomSheetStore.getState().remove('sheet-1')
        await expect(promise).resolves.toBe('scan')
    })

    it("learn-more option resolves with 'learn-more'", async () => {
        const promise = useBottomSheetStore
            .getState()
            .request<Result>({ id: 'sheet-1', contents: null })
        renderWithId('sheet-1')

        fireEvent.click(
            screen.getByText(
                'onboarding.import_account.support_options.learn_more',
            ),
        )
        useBottomSheetStore.getState().remove('sheet-1')
        await expect(promise).resolves.toBe('learn-more')
    })

    it('close icon dismisses', async () => {
        const promise = useBottomSheetStore
            .getState()
            .request<Result>({ id: 'sheet-1', contents: null })
        renderWithId('sheet-1')

        fireEvent.click(screen.getByTestId('icon-cross'))

        useBottomSheetStore.getState().remove('sheet-1')
        await expect(promise).resolves.toBeUndefined()
    })
})

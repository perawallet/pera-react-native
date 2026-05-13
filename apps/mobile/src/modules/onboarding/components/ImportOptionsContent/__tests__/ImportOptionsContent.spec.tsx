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
import { ImportOptionsContent } from '../ImportOptionsContent'

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
    }),
}))

const renderWithId = (id = 'sheet-1') =>
    render(
        <BottomSheetIdContext.Provider value={id}>
            <ImportOptionsContent />
        </BottomSheetIdContext.Provider>,
    )

describe('ImportOptionsContent', () => {
    beforeEach(() => {
        useBottomSheetStore.getState().resetState()
        vi.clearAllMocks()
    })

    it('renders title and both option titles', () => {
        renderWithId()
        expect(screen.getByText('onboarding.import_options.title')).toBeTruthy()
        expect(
            screen.getByText('onboarding.import_options.hd_wallet.title'),
        ).toBeTruthy()
        expect(
            screen.getByText('onboarding.import_options.algo25.title'),
        ).toBeTruthy()
    })

    it('close button dismisses (caller promise resolves with undefined)', async () => {
        const promise = useBottomSheetStore
            .getState()
            .request<'hdWallet' | 'algo25'>({ id: 'sheet-1', contents: null })
        renderWithId('sheet-1')

        fireEvent.click(screen.getByTestId('icon-cross'))

        useBottomSheetStore.getState().remove('sheet-1')
        await expect(promise).resolves.toBeUndefined()
    })

    it("HD wallet option resolves with 'hdWallet'", async () => {
        const promise = useBottomSheetStore
            .getState()
            .request<'hdWallet' | 'algo25'>({ id: 'sheet-1', contents: null })
        renderWithId('sheet-1')

        fireEvent.click(
            screen.getByText('onboarding.import_options.hd_wallet.title'),
        )

        useBottomSheetStore.getState().remove('sheet-1')
        await expect(promise).resolves.toBe('hdWallet')
    })

    it("Algo25 option resolves with 'algo25'", async () => {
        const promise = useBottomSheetStore
            .getState()
            .request<'hdWallet' | 'algo25'>({ id: 'sheet-1', contents: null })
        renderWithId('sheet-1')

        fireEvent.click(
            screen.getByText('onboarding.import_options.algo25.title'),
        )

        useBottomSheetStore.getState().remove('sheet-1')
        await expect(promise).resolves.toBe('algo25')
    })
})

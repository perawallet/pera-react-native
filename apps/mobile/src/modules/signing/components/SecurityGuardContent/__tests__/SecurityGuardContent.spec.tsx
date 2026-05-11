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
import { SecurityGuardContent } from '../SecurityGuardContent'
import { usePreferences } from '@perawallet/wallet-core-settings'

const mockGetPreference = vi.fn()

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({
        t: (key: string) => key,
    }),
}))

vi.mock('@perawallet/wallet-core-settings', () => ({
    usePreferences: vi.fn(),
}))

const renderWithId = (
    warningType: 'rekey' | 'asset-freeze' = 'rekey',
    id = 'sheet-1',
) =>
    render(
        <BottomSheetIdContext.Provider value={id}>
            <SecurityGuardContent warningType={warningType} />
        </BottomSheetIdContext.Provider>,
    )

describe('SecurityGuardContent', () => {
    beforeEach(() => {
        useBottomSheetStore.getState().resetState()
        vi.clearAllMocks()
        mockGetPreference.mockReturnValue(undefined)
        vi.mocked(usePreferences).mockReturnValue({
            getPreference: mockGetPreference,
        } as unknown as ReturnType<typeof usePreferences>)
    })

    it('shows confirm-go-to-settings copy when rekey support is disabled', () => {
        renderWithId('rekey')

        expect(
            screen.getByText('transactions.warning.rekey_confirm_title'),
        ).toBeTruthy()
        expect(
            screen.getByText(
                'transactions.warning.rekey_confirm_go_to_settings',
            ),
        ).toBeTruthy()
    })

    it('shows are-you-sure copy when support is enabled', () => {
        mockGetPreference.mockReturnValue(true)
        renderWithId('rekey')

        expect(
            screen.getByText('transactions.warning.rekey_are_you_sure_title'),
        ).toBeTruthy()
        expect(
            screen.getByText(
                'transactions.warning.rekey_are_you_sure_continue',
            ),
        ).toBeTruthy()
    })

    it("resolves with 'confirm' when primary 'are you sure' button is pressed", async () => {
        mockGetPreference.mockReturnValue(true)
        const promise = useBottomSheetStore
            .getState()
            .request<'confirm' | 'go-to-settings'>({
                id: 'sheet-1',
                contents: null,
            })
        renderWithId('rekey', 'sheet-1')

        fireEvent.click(
            screen.getByText(
                'transactions.warning.rekey_are_you_sure_continue',
            ),
        )
        useBottomSheetStore.getState().remove('sheet-1')

        await expect(promise).resolves.toBe('confirm')
    })

    it("resolves with 'go-to-settings' when go-to-settings button is pressed", async () => {
        const promise = useBottomSheetStore
            .getState()
            .request<'confirm' | 'go-to-settings'>({
                id: 'sheet-1',
                contents: null,
            })
        renderWithId('rekey', 'sheet-1')

        fireEvent.click(
            screen.getByText(
                'transactions.warning.rekey_confirm_go_to_settings',
            ),
        )
        useBottomSheetStore.getState().remove('sheet-1')

        await expect(promise).resolves.toBe('go-to-settings')
    })

    it('dismisses (resolves with undefined) when cancel is pressed', async () => {
        const promise = useBottomSheetStore
            .getState()
            .request<'confirm' | 'go-to-settings'>({
                id: 'sheet-1',
                contents: null,
            })
        renderWithId('rekey', 'sheet-1')

        fireEvent.click(screen.getByText('common.cancel.label'))
        useBottomSheetStore.getState().remove('sheet-1')

        await expect(promise).resolves.toBeUndefined()
    })
})

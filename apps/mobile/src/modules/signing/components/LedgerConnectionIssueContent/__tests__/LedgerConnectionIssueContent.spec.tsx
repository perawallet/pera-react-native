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
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen } from '@test-utils/render'
import {
    BottomSheetIdContext,
    useBottomSheetStore,
} from '@modules/bottom-sheet'
import { LedgerConnectionIssueContent } from '../LedgerConnectionIssueContent'

vi.mock('@components/core', () => ({
    PWView: ({ children }: { children: React.ReactNode }) => (
        <div>{children}</div>
    ),
    PWText: ({ children }: { children: React.ReactNode }) => (
        <span>{children}</span>
    ),
    PWButton: ({
        title,
        onPress,
        testID,
    }: {
        title: string
        onPress: () => void
        testID?: string
    }) => (
        <button
            data-testid={testID}
            onClick={onPress}
        >
            {title}
        </button>
    ),
}))

const renderWithId = (id = 'sheet-1') =>
    render(
        <BottomSheetIdContext.Provider value={id}>
            <LedgerConnectionIssueContent />
        </BottomSheetIdContext.Provider>,
    )

describe('LedgerConnectionIssueContent', () => {
    beforeEach(() => {
        useBottomSheetStore.getState().resetState()
        vi.clearAllMocks()
    })

    it('renders the close action and tips', () => {
        renderWithId()

        expect(
            screen.queryByTestId('ledger-troubleshooting-close'),
        ).toBeTruthy()
        expect(
            screen.getByText('ledger.troubleshooting.tip_unlocked'),
        ).toBeTruthy()
        expect(
            screen.getByText('ledger.troubleshooting.tip_app_open'),
        ).toBeTruthy()
    })

    it('dismisses the sheet when the close button is pressed', async () => {
        const promise = useBottomSheetStore
            .getState()
            .request<void>({ id: 'sheet-1', contents: null })
        renderWithId('sheet-1')

        fireEvent.click(screen.getByTestId('ledger-troubleshooting-close'))

        useBottomSheetStore.getState().remove('sheet-1')
        await expect(promise).resolves.toBeUndefined()
    })
})

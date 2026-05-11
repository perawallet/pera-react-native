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
import React from 'react'
import { render, screen } from '@test-utils/render'
import {
    BottomSheetIdContext,
    useBottomSheetStore,
} from '@modules/bottom-sheet'
import { SendFundsContent } from '../SendFundsContent'
import { useSendFundsContent } from '../useSendFundsContent'

vi.mock('../useSendFundsContent', () => ({
    useSendFundsContent: vi.fn(),
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({
        t: (key: string) => key,
    }),
}))

vi.mock('@react-navigation/native', () => ({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    NavigationContainer: ({ children }: any) => <div>{children}</div>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    NavigationIndependentTree: ({ children }: any) => <div>{children}</div>,
}))

vi.mock('../../../../routes/send-funds', () => ({
    SendFundsRoutes: () => <div data-testid='send-funds-routes' />,
}))

vi.mock(
    '@modules/transactions/components/TransactionErrorBoundary/TransactionErrorBoundary',
    () => ({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        TransactionErrorBoundary: ({ children }: any) => (
            <div data-testid='error-boundary'>{children}</div>
        ),
    }),
)

const renderWithId = (
    id = 'sheet-1',
    props?: React.ComponentProps<typeof SendFundsContent>,
) =>
    render(
        <BottomSheetIdContext.Provider value={id}>
            <SendFundsContent {...props} />
        </BottomSheetIdContext.Provider>,
    )

describe('SendFundsContent', () => {
    beforeEach(() => {
        useBottomSheetStore.getState().resetState()
        vi.clearAllMocks()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(useSendFundsContent as any).mockReturnValue({
            selectedAccount: { address: 'test-address' },
        })
    })

    it('renders SendFundsRoutes when account is selected', () => {
        renderWithId()

        expect(screen.getByTestId('send-funds-routes')).toBeTruthy()
    })

    it('renders EmptyView when no account is selected', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(useSendFundsContent as any).mockReturnValue({
            selectedAccount: null,
        })

        const { container } = renderWithId()

        expect(container.textContent).toContain(
            'send_funds.bottom_sheet.no_account_title',
        )
    })

    it('passes assetId to the companion hook', () => {
        renderWithId('sheet-1', { assetId: '123' })

        expect(useSendFundsContent).toHaveBeenCalledWith('123')
    })
})

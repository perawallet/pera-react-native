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
import { ReceiveFundsContent } from '../ReceiveFundsContent'
import { useReceiveFundsContent } from '../useReceiveFundsContent'

vi.mock('../useReceiveFundsContent', () => ({
    useReceiveFundsContent: vi.fn(),
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

vi.mock('../../../../routes/receive-funds', () => ({
    ReceiveFundsRoutes: () => <div data-testid='receive-funds-routes' />,
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

const mockAccount = {
    address: 'test-address-123',
    name: 'Test Account',
    type: 'watch' as const,
}

const renderWithId = (
    id = 'sheet-1',
    props?: React.ComponentProps<typeof ReceiveFundsContent>,
) =>
    render(
        <BottomSheetIdContext.Provider value={id}>
            <ReceiveFundsContent {...props} />
        </BottomSheetIdContext.Provider>,
    )

describe('ReceiveFundsContent', () => {
    beforeEach(() => {
        useBottomSheetStore.getState().resetState()
        vi.clearAllMocks()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(useReceiveFundsContent as any).mockReturnValue({
            hasAccount: true,
        })
    })

    it('renders ReceiveFundsRoutes', () => {
        renderWithId()

        expect(screen.getByTestId('receive-funds-routes')).toBeTruthy()
    })

    it('passes the account to the companion hook', () => {
        renderWithId('sheet-1', { account: mockAccount })

        expect(useReceiveFundsContent).toHaveBeenCalledWith(mockAccount)
    })

    it('wraps in error boundary', () => {
        renderWithId()

        expect(screen.getByTestId('error-boundary')).toBeTruthy()
    })
})

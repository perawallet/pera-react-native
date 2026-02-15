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
import { render, screen } from '@test-utils/render'
import { SendFundsBottomSheet } from '../SendFundsBottomSheet'
import { useSendFundsBottomSheet } from '../useSendFundsBottomSheet'

vi.mock('../useSendFundsBottomSheet', () => ({
    useSendFundsBottomSheet: vi.fn(),
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({
        t: (key: string) => key,
    }),
}))

vi.mock('@components/core', () => ({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    PWBottomSheet: ({ children, isVisible }: any) =>
        isVisible ? <div data-testid='bottom-sheet'>{children}</div> : null,
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
    '@modules/transactions/components/BaseErrorBoundary/TransactionErrorBoundary',
    () => ({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        TransactionErrorBoundary: ({ children }: any) => (
            <div data-testid='error-boundary'>{children}</div>
        ),
    }),
)

vi.mock('react-native', async () => {
    const actual = await vi.importActual('react-native')
    return {
        ...actual,
        useWindowDimensions: () => ({ width: 375, height: 812 }),
    }
})

describe('SendFundsBottomSheet', () => {
    const mockOnClose = vi.fn()

    beforeEach(() => {
        vi.clearAllMocks()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(useSendFundsBottomSheet as any).mockReturnValue({
            selectedAccount: { address: 'test-address' },
        })
    })

    it('renders SendFundsRoutes when account is selected', () => {
        render(
            <SendFundsBottomSheet
                isVisible={true}
                onClose={mockOnClose}
            />,
        )

        expect(screen.getByTestId('bottom-sheet')).toBeTruthy()
        expect(screen.getByTestId('send-funds-routes')).toBeTruthy()
    })

    it('renders EmptyView when no account is selected', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(useSendFundsBottomSheet as any).mockReturnValue({
            selectedAccount: null,
        })

        const { container } = render(
            <SendFundsBottomSheet
                isVisible={true}
                onClose={mockOnClose}
            />,
        )

        expect(container.textContent).toContain(
            'send_funds.bottom_sheet.no_account_title',
        )
    })

    it('does not render when isVisible is false', () => {
        render(
            <SendFundsBottomSheet
                isVisible={false}
                onClose={mockOnClose}
            />,
        )

        expect(screen.queryByTestId('bottom-sheet')).toBeNull()
    })

    it('passes isVisible, assetId and onClose to hook', () => {
        render(
            <SendFundsBottomSheet
                isVisible={true}
                onClose={mockOnClose}
                assetId='123'
            />,
        )

        expect(useSendFundsBottomSheet).toHaveBeenCalledWith(
            true,
            '123',
            mockOnClose,
        )
    })
})

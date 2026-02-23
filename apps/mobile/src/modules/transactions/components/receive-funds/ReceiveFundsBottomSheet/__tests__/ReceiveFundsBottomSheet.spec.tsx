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
import { ReceiveFundsBottomSheet } from '../ReceiveFundsBottomSheet'
import { useReceiveFundsBottomSheet } from '../useReceiveFundsBottomSheet'

vi.mock('../useReceiveFundsBottomSheet', () => ({
    useReceiveFundsBottomSheet: vi.fn(),
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

vi.mock('react-native', async () => {
    const actual = await vi.importActual('react-native')
    return {
        ...actual,
        useWindowDimensions: () => ({ width: 375, height: 812 }),
    }
})

const mockAccount = {
    address: 'test-address-123',
    name: 'Test Account',
    type: 'watch' as const,
}

describe('ReceiveFundsBottomSheet', () => {
    const mockOnClose = vi.fn()

    beforeEach(() => {
        vi.clearAllMocks()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(useReceiveFundsBottomSheet as any).mockReturnValue({
            hasAccount: true,
        })
    })

    it('renders ReceiveFundsRoutes when visible', () => {
        render(
            <ReceiveFundsBottomSheet
                isVisible={true}
                onClose={mockOnClose}
            />,
        )

        expect(screen.getByTestId('bottom-sheet')).toBeTruthy()
        expect(screen.getByTestId('receive-funds-routes')).toBeTruthy()
    })

    it('does not render when isVisible is false', () => {
        render(
            <ReceiveFundsBottomSheet
                isVisible={false}
                onClose={mockOnClose}
            />,
        )

        expect(screen.queryByTestId('bottom-sheet')).toBeNull()
    })

    it('passes isVisible, account and onClose to hook', () => {
        render(
            <ReceiveFundsBottomSheet
                isVisible={true}
                onClose={mockOnClose}
                account={mockAccount}
            />,
        )

        expect(useReceiveFundsBottomSheet).toHaveBeenCalledWith(
            true,
            mockAccount,
            mockOnClose,
        )
    })

    it('renders with error boundary', () => {
        render(
            <ReceiveFundsBottomSheet
                isVisible={true}
                onClose={mockOnClose}
            />,
        )

        expect(screen.getByTestId('error-boundary')).toBeTruthy()
    })
})

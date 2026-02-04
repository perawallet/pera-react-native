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

import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@test-utils/render'
import { WalletAccount } from '@perawallet/wallet-core-accounts'
vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({
        t: (key: string) => key,
    }),
}))

vi.mock('@components/core', () => ({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    PWBottomSheet: ({ children, isVisible }: any) =>
        isVisible ? <div data-testid='bottom-sheet'>{children}</div> : null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    PWView: ({ children, style, ...rest }: any) => (
        <div
            style={style}
            {...rest}
        >
            {children}
        </div>
    ),
    PWText: ({
        children,
        style,
        ...rest
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }: any) => (
        <span
            style={style}
            {...rest}
        >
            {children}
        </span>
    ),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    PWButton: ({ title, onPress }: any) => (
        <button onClick={onPress}>{title}</button>
    ),
    PWTabView: {
        createNavigator: () => ({
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            Navigator: ({ children, tabBarHidden }: any) => (
                <div
                    data-testid='tab-navigator'
                    data-hidden-tabs={String(!!tabBarHidden)}
                >
                    {children}
                </div>
            ),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            Screen: ({ children }: any) => (
                <div>
                    {typeof children === 'function'
                        ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          children({ navigation: {} } as any)
                        : children}
                </div>
            ),
        }),
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    PWHeader: ({ children }: any) => <div>{children}</div>,
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

vi.mock('../../AccountSelection/ReceiveFundsAccountSelectionView', () => ({
    ReceiveFundsAccountSelectionView: () => (
        <div data-testid='account-selection' />
    ),
}))

vi.mock('../../QrView/ReceiveFundsQRView', () => ({
    ReceiveFundsQRView: () => <div data-testid='qr-view' />,
}))

// Import after mocks
import { ReceiveFundsBottomSheet } from '../ReceiveFundsBottomSheet'

describe('ReceiveFundsBottomSheet', () => {
    const mockAccount = {
        address: 'test-address',
        name: 'Test Account',
    } as WalletAccount
    const mockOnClose = vi.fn()

    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('does not render when isVisible is false', () => {
        render(
            <ReceiveFundsBottomSheet
                isVisible={false}
                onClose={mockOnClose}
            />,
        )

        expect(screen.queryByTestId('bottom-sheet')).toBeFalsy()
    })

    it('renders when isVisible is true', () => {
        render(
            <ReceiveFundsBottomSheet
                isVisible={true}
                onClose={mockOnClose}
            />,
        )

        expect(screen.getByTestId('bottom-sheet')).toBeTruthy()
        expect(screen.getByTestId('error-boundary')).toBeTruthy()
    })

    it('renders tab navigator when no account is provided', () => {
        render(
            <ReceiveFundsBottomSheet
                isVisible={true}
                onClose={mockOnClose}
            />,
        )

        expect(screen.getByTestId('tab-navigator')).toBeTruthy()
    })

    it('renders QR view and tab navigator when account is provided', () => {
        render(
            <ReceiveFundsBottomSheet
                account={mockAccount}
                isVisible={true}
                onClose={mockOnClose}
            />,
        )

        expect(screen.getByTestId('qr-view')).toBeTruthy()
        expect(screen.getByTestId('tab-navigator')).toBeTruthy()
        expect(
            screen
                .getByTestId('tab-navigator')
                .getAttribute('data-hidden-tabs'),
        ).toBe('true')
    })
})

import { describe, test, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ConnectionSuccessBottomSheet } from '../ConnectionSuccessBottomSheet'
import type { WalletConnectSessionRequest } from '@perawallet/wallet-core-walletconnect'

const mockOnClose = vi.fn()

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({
        t: (key: string, opts?: Record<string, unknown>) =>
            opts ? `${key}:${JSON.stringify(opts)}` : key,
    }),
}))

vi.mock('@components/core', () => ({
    PWBottomSheet: ({
        children,
        isVisible,
    }: {
        children: React.ReactNode
        isVisible: boolean
    }) =>
        isVisible ? <div data-testid='PWBottomSheet'>{children}</div> : null,
    PWButton: ({ title, onPress }: { title: string; onPress: () => void }) => (
        <button onClick={onPress}>{title}</button>
    ),
    PWIcon: () => <div data-testid='PWIcon' />,
    PWText: ({ children }: { children: React.ReactNode }) => (
        <span>{children}</span>
    ),
}))

vi.mock('../styles', () => ({
    useStyles: () => ({
        container: {},
        icon: {},
        message: {},
    }),
}))

const mockRequest = {
    peerMeta: {
        name: 'Test dApp',
        url: 'https://test-dapp.com',
        icons: [],
        description: 'A test dApp',
    },
    chainId: 416001,
    permissions: ['algo_getAccounts'],
    clientId: 'client-123',
} as unknown as WalletConnectSessionRequest

describe('ConnectionSuccessBottomSheet', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    test('does not render when request is null', () => {
        render(
            <ConnectionSuccessBottomSheet
                onClose={mockOnClose}
                request={null}
            />,
        )

        expect(screen.queryByTestId('PWBottomSheet')).toBeNull()
    })

    test('renders when request is provided', () => {
        render(
            <ConnectionSuccessBottomSheet
                onClose={mockOnClose}
                request={mockRequest}
            />,
        )

        expect(screen.getByTestId('PWBottomSheet')).toBeDefined()
    })

    test('displays the dApp name in title and body', () => {
        render(
            <ConnectionSuccessBottomSheet
                onClose={mockOnClose}
                request={mockRequest}
            />,
        )

        expect(
            screen.getByText(
                /walletconnect\.request\.success_sheet_title.*Test dApp/,
            ),
        ).toBeDefined()
        expect(
            screen.getByText(
                /walletconnect\.request\.success_sheet_body.*Test dApp/,
            ),
        ).toBeDefined()
    })

    test('shows the check icon', () => {
        render(
            <ConnectionSuccessBottomSheet
                onClose={mockOnClose}
                request={mockRequest}
            />,
        )

        expect(screen.getByTestId('PWIcon')).toBeDefined()
    })

    test('calls onClose when Close button is pressed', () => {
        render(
            <ConnectionSuccessBottomSheet
                onClose={mockOnClose}
                request={mockRequest}
            />,
        )

        fireEvent.click(screen.getByText('common.close.label'))

        expect(mockOnClose).toHaveBeenCalledTimes(1)
    })
})

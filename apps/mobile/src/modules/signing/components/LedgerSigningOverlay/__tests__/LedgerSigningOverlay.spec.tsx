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
import { render, screen, fireEvent } from '@test-utils/render'
import { LedgerSigningOverlay } from '../LedgerSigningOverlay'

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({
        t: (key: string, params?: Record<string, unknown>) =>
            params ? `${key}|${JSON.stringify(params)}` : key,
    }),
}))

const mockUseIsDarkMode = vi.fn<() => boolean>(() => false)
vi.mock('@hooks/useIsDarkMode', () => ({
    useIsDarkMode: () => mockUseIsDarkMode(),
}))

vi.mock('lottie-react-native', () => ({
    default: ({
        testID,
        source,
    }: {
        testID?: string
        source?: { __variant?: string }
    }) => (
        <div
            data-testid={testID ?? 'lottie-view'}
            data-variant={source?.__variant ?? ''}
        />
    ),
}))

vi.mock('@assets/animations/ledger-bluetooth.json', () => ({
    default: { __variant: 'light' },
}))

vi.mock('@assets/animations/ledger-bluetooth.dark.json', () => ({
    default: { __variant: 'dark' },
}))

describe('LedgerSigningOverlay', () => {
    const defaultProps = {
        isVisible: true,
        status: 'connecting' as const,
        onCancel: vi.fn(),
        onRetry: vi.fn(),
    }

    beforeEach(() => {
        vi.clearAllMocks()
        mockUseIsDarkMode.mockReturnValue(false)
    })

    it('renders the connecting message when status is connecting', () => {
        render(
            <LedgerSigningOverlay
                {...defaultProps}
                status='connecting'
            />,
        )

        expect(screen.getByText('ledger.signing.connect')).toBeTruthy()
    })

    it('renders the confirming message when status is confirming', () => {
        render(
            <LedgerSigningOverlay
                {...defaultProps}
                status='confirming'
            />,
        )

        expect(screen.getByText('ledger.signing.confirm')).toBeTruthy()
    })

    it('shows progress text when signing multiple transactions', () => {
        render(
            <LedgerSigningOverlay
                {...defaultProps}
                status='confirming'
                currentTx={2}
                totalTxs={3}
            />,
        )

        expect(
            screen.getByText('ledger.signing.progress|{"current":2,"total":3}'),
        ).toBeTruthy()
    })

    it('hides progress text for a single transaction', () => {
        render(
            <LedgerSigningOverlay
                {...defaultProps}
                status='confirming'
                currentTx={1}
                totalTxs={1}
            />,
        )

        expect(screen.queryByText(/ledger.signing.progress/)).toBeNull()
    })

    it('shows the retry button when status is error', () => {
        render(
            <LedgerSigningOverlay
                {...defaultProps}
                status='error'
            />,
        )

        expect(screen.getByText('ledger.fetch_accounts.retry')).toBeTruthy()
    })

    it('shows the retry button when status is timeout', () => {
        render(
            <LedgerSigningOverlay
                {...defaultProps}
                status='timeout'
            />,
        )

        expect(screen.getByText('ledger.fetch_accounts.retry')).toBeTruthy()
    })

    it('renders the bluetooth Lottie animation while connecting', () => {
        render(
            <LedgerSigningOverlay
                {...defaultProps}
                status='connecting'
            />,
        )

        expect(screen.getByTestId('ledger-signing-overlay-lottie')).toBeTruthy()
    })

    it('uses the light Lottie variant when not in dark mode', () => {
        mockUseIsDarkMode.mockReturnValue(false)
        render(
            <LedgerSigningOverlay
                {...defaultProps}
                status='connecting'
            />,
        )

        expect(
            screen
                .getByTestId('ledger-signing-overlay-lottie')
                .getAttribute('data-variant'),
        ).toBe('light')
    })

    it('uses the dark Lottie variant in dark mode', () => {
        mockUseIsDarkMode.mockReturnValue(true)
        render(
            <LedgerSigningOverlay
                {...defaultProps}
                status='connecting'
            />,
        )

        expect(
            screen
                .getByTestId('ledger-signing-overlay-lottie')
                .getAttribute('data-variant'),
        ).toBe('dark')
    })

    it('hides the Lottie animation in error state (replaced by retry UI)', () => {
        render(
            <LedgerSigningOverlay
                {...defaultProps}
                status='error'
            />,
        )

        expect(screen.queryByTestId('ledger-signing-overlay-lottie')).toBeNull()
    })

    it('hides the retry button while connecting', () => {
        render(
            <LedgerSigningOverlay
                {...defaultProps}
                status='connecting'
            />,
        )

        expect(screen.queryByText('ledger.fetch_accounts.retry')).toBeNull()
    })

    it('calls onCancel when the cancel button is pressed', () => {
        const onCancel = vi.fn()
        render(
            <LedgerSigningOverlay
                {...defaultProps}
                onCancel={onCancel}
            />,
        )

        fireEvent.click(screen.getByText('ledger.signing.cancel'))

        expect(onCancel).toHaveBeenCalledTimes(1)
    })

    it('calls onRetry when retry is pressed in error state', () => {
        const onRetry = vi.fn()
        render(
            <LedgerSigningOverlay
                {...defaultProps}
                status='error'
                onRetry={onRetry}
            />,
        )

        fireEvent.click(screen.getByText('ledger.fetch_accounts.retry'))

        expect(onRetry).toHaveBeenCalledTimes(1)
    })
})

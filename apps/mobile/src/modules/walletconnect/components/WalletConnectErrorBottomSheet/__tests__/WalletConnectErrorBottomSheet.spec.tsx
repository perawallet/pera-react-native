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

import { describe, test, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { WalletConnectErrorBottomSheet } from '../WalletConnectErrorBottomSheet'

const mockOnClose = vi.fn()

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({
        t: (key: string) => key,
    }),
}))

vi.mock('@perawallet/wallet-core-shared', () => ({
    logger: { debug: vi.fn() },
}))

vi.mock('@perawallet/wallet-core-config', () => ({
    config: { debugEnabled: false },
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
        errorMessage: {},
        retryMessage: {},
    }),
}))

describe('WalletConnectErrorBottomSheet', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    test('does not render when isVisible is false', () => {
        render(
            <WalletConnectErrorBottomSheet
                isVisible={false}
                error={new Error('Some error')}
                onClose={mockOnClose}
            />,
        )

        expect(screen.queryByTestId('PWBottomSheet')).toBeNull()
    })

    test('renders when isVisible is true', () => {
        render(
            <WalletConnectErrorBottomSheet
                isVisible={true}
                error={new Error('Some error')}
                onClose={mockOnClose}
            />,
        )

        expect(screen.getByTestId('PWBottomSheet')).toBeDefined()
    })

    test('displays the error message', () => {
        render(
            <WalletConnectErrorBottomSheet
                isVisible={true}
                error={new Error('Invalid public key(s)')}
                onClose={mockOnClose}
            />,
        )

        expect(screen.getByText('Invalid public key(s)')).toBeDefined()
    })

    test('displays the error icon', () => {
        render(
            <WalletConnectErrorBottomSheet
                isVisible={true}
                error={new Error('Some error')}
                onClose={mockOnClose}
            />,
        )

        expect(screen.getByTestId('PWIcon')).toBeDefined()
    })

    test('calls onClose when Ok button is pressed', () => {
        render(
            <WalletConnectErrorBottomSheet
                isVisible={true}
                error={new Error('Some error')}
                onClose={mockOnClose}
            />,
        )

        fireEvent.click(screen.getByText('common.ok.label'))

        expect(mockOnClose).toHaveBeenCalledTimes(1)
    })
})

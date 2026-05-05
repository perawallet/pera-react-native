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
import { render, screen, fireEvent } from '@test-utils/render'
import { CloseAccountPanel } from '../CloseAccountPanel'

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({
        t: (key: string) => key,
    }),
}))

vi.mock('../styles', () => ({
    useStyles: () => ({}),
}))

vi.mock('@components/core', () => ({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    PWBottomSheet: ({ children, isVisible }: any) =>
        isVisible ? <div data-testid='bottom-sheet'>{children}</div> : null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    PWButton: ({ onPress, title }: any) => (
        <button onClick={onPress}>{title}</button>
    ),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    PWText: ({ children }: any) => <span>{children}</span>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    PWView: ({ children }: any) => <div>{children}</div>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    PWIcon: ({ name, variant }: any) => (
        <div data-testid={`icon-${name}-${variant}`} />
    ),
}))

describe('CloseAccountPanel', () => {
    const mockOnClose = vi.fn()
    const mockOnConfirm = vi.fn()

    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders content when isVisible is true', () => {
        render(
            <CloseAccountPanel
                isVisible={true}
                onClose={mockOnClose}
                onConfirm={mockOnConfirm}
            />,
        )

        expect(screen.getByTestId('bottom-sheet')).toBeTruthy()
        expect(screen.getByText('send_funds.close_account.title')).toBeTruthy()
        expect(screen.getByText('send_funds.close_account.body')).toBeTruthy()
    })

    it('does not render when isVisible is false', () => {
        render(
            <CloseAccountPanel
                isVisible={false}
                onClose={mockOnClose}
                onConfirm={mockOnConfirm}
            />,
        )

        expect(screen.queryByTestId('bottom-sheet')).toBeNull()
    })

    it('shows error variant icon', () => {
        render(
            <CloseAccountPanel
                isVisible={true}
                onClose={mockOnClose}
                onConfirm={mockOnConfirm}
            />,
        )

        expect(screen.getByTestId('icon-warning-error')).toBeTruthy()
    })

    it('calls onClose when cancel button is pressed', () => {
        render(
            <CloseAccountPanel
                isVisible={true}
                onClose={mockOnClose}
                onConfirm={mockOnConfirm}
            />,
        )

        fireEvent.click(screen.getByText('common.cancel.label'))

        expect(mockOnClose).toHaveBeenCalledTimes(1)
    })

    it('calls onConfirm when confirm button is pressed', () => {
        render(
            <CloseAccountPanel
                isVisible={true}
                onClose={mockOnClose}
                onConfirm={mockOnConfirm}
            />,
        )

        fireEvent.click(screen.getByText('send_funds.close_account.confirm'))

        expect(mockOnConfirm).toHaveBeenCalledTimes(1)
    })
})

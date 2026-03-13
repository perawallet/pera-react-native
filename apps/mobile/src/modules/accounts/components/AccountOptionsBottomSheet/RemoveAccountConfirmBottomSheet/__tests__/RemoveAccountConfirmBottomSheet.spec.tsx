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
import React from 'react'
import { render, screen, fireEvent } from '@test-utils/render'
import { RemoveAccountConfirmBottomSheet } from '../RemoveAccountConfirmBottomSheet'

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({
        t: (key: string) => key,
    }),
}))

describe('RemoveAccountConfirmBottomSheet', () => {
    const defaultProps = {
        isVisible: true,
        onClose: vi.fn(),
        onConfirm: vi.fn(),
    }

    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('does not render content when isVisible is false', () => {
        render(
            <RemoveAccountConfirmBottomSheet
                {...defaultProps}
                isVisible={false}
            />,
        )

        expect(screen.queryByTestId('PWBottomSheet')).toBeNull()
    })

    it('renders trash icon, title, message, and action buttons when visible', () => {
        render(<RemoveAccountConfirmBottomSheet {...defaultProps} />)

        expect(screen.getByTestId('icon-trash')).toBeTruthy()
        expect(screen.getByText('account_options.remove_title')).toBeTruthy()
        expect(screen.getByText('account_options.remove_message')).toBeTruthy()
        expect(screen.getByText('account_options.remove_confirm')).toBeTruthy()
        expect(screen.getByText('account_options.remove_cancel')).toBeTruthy()
    })

    it('calls onConfirm when confirm button is pressed', () => {
        render(<RemoveAccountConfirmBottomSheet {...defaultProps} />)

        fireEvent.click(screen.getByText('account_options.remove_confirm'))

        expect(defaultProps.onConfirm).toHaveBeenCalled()
    })

    it('calls onClose when cancel button is pressed', () => {
        render(<RemoveAccountConfirmBottomSheet {...defaultProps} />)

        fireEvent.click(screen.getByText('account_options.remove_cancel'))

        expect(defaultProps.onClose).toHaveBeenCalled()
    })

    describe('when isWatchAccount is true', () => {
        it('renders watch-specific removal message', () => {
            render(
                <RemoveAccountConfirmBottomSheet
                    {...defaultProps}
                    isWatchAccount={true}
                />,
            )

            expect(
                screen.getByText('account_options.remove_watch_message'),
            ).toBeTruthy()
            expect(
                screen.queryByText('account_options.remove_message'),
            ).toBeNull()
        })

        it('still renders title and action buttons', () => {
            render(
                <RemoveAccountConfirmBottomSheet
                    {...defaultProps}
                    isWatchAccount={true}
                />,
            )

            expect(
                screen.getByText('account_options.remove_title'),
            ).toBeTruthy()
            expect(
                screen.getByText('account_options.remove_confirm'),
            ).toBeTruthy()
            expect(
                screen.getByText('account_options.remove_cancel'),
            ).toBeTruthy()
        })

        it('calls onConfirm when confirm button is pressed', () => {
            render(
                <RemoveAccountConfirmBottomSheet
                    {...defaultProps}
                    isWatchAccount={true}
                />,
            )

            fireEvent.click(screen.getByText('account_options.remove_confirm'))

            expect(defaultProps.onConfirm).toHaveBeenCalled()
        })
    })

    it('renders standard message when isWatchAccount is false', () => {
        render(
            <RemoveAccountConfirmBottomSheet
                {...defaultProps}
                isWatchAccount={false}
            />,
        )

        expect(screen.getByText('account_options.remove_message')).toBeTruthy()
        expect(
            screen.queryByText('account_options.remove_watch_message'),
        ).toBeNull()
    })

    it('renders standard message when isWatchAccount is not provided', () => {
        render(<RemoveAccountConfirmBottomSheet {...defaultProps} />)

        expect(screen.getByText('account_options.remove_message')).toBeTruthy()
    })
})

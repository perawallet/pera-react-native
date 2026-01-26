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
import { render, fireEvent, screen } from '@test-utils/render'
import { DeleteAllConfirmBottomSheet } from '../DeleteAllConfirmBottomSheet'

const mockHandleDeleteAllAccounts = vi.fn()

vi.mock('../useDeleteAllConfirm', () => ({
    useDeleteAllConfirm: () => ({
        handleDeleteAllAccounts: mockHandleDeleteAllAccounts,
    }),
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({
        t: (key: string) => key,
    }),
}))

describe('DeleteAllConfirmBottomSheet', () => {
    const mockOnClose = vi.fn()

    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders title and message when open', () => {
        render(
            <DeleteAllConfirmBottomSheet
                isOpen={true}
                onClose={mockOnClose}
            />,
        )

        expect(screen.getByText('settings.main.remove_title')).toBeTruthy()
        expect(screen.getByText('settings.main.remove_message')).toBeTruthy()
    })

    it('renders confirm and cancel buttons', () => {
        render(
            <DeleteAllConfirmBottomSheet
                isOpen={true}
                onClose={mockOnClose}
            />,
        )

        expect(screen.getByText('settings.main.remove_confirm')).toBeTruthy()
        expect(screen.getByText('settings.main.remove_cancel')).toBeTruthy()
    })

    it('calls handleDeleteAllAccounts when confirm button is pressed', () => {
        render(
            <DeleteAllConfirmBottomSheet
                isOpen={true}
                onClose={mockOnClose}
            />,
        )

        fireEvent.click(screen.getByText('settings.main.remove_confirm'))

        expect(mockHandleDeleteAllAccounts).toHaveBeenCalledTimes(1)
    })

    it('calls onClose when cancel button is pressed', () => {
        render(
            <DeleteAllConfirmBottomSheet
                isOpen={true}
                onClose={mockOnClose}
            />,
        )

        fireEvent.click(screen.getByText('settings.main.remove_cancel'))

        expect(mockOnClose).toHaveBeenCalledTimes(1)
    })
})

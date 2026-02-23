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
import { Keyboard } from 'react-native'
import { render, screen, fireEvent } from '@test-utils/render'
import { RenameAccountBottomSheet } from '../RenameAccountBottomSheet'

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({
        t: (key: string) => key,
    }),
}))

describe('RenameAccountBottomSheet', () => {
    const defaultProps = {
        isVisible: true,
        onClose: vi.fn(),
        onRename: vi.fn(),
        currentName: 'My Account',
    }

    beforeEach(() => {
        vi.clearAllMocks()
        vi.mocked(Keyboard.addListener).mockReturnValue({
            remove: vi.fn(),
        })
    })

    it('does not render content when isVisible is false', () => {
        render(
            <RenameAccountBottomSheet
                {...defaultProps}
                isVisible={false}
            />,
        )

        expect(screen.queryByTestId('PWBottomSheet')).toBeNull()
    })

    it('renders title and save button when visible', () => {
        render(<RenameAccountBottomSheet {...defaultProps} />)

        expect(screen.getByText('account_options.rename_title')).toBeTruthy()
        expect(screen.getByText('account_options.rename_save')).toBeTruthy()
    })

    it('renders input with current name', () => {
        render(<RenameAccountBottomSheet {...defaultProps} />)

        const input = screen.getByTestId('PWInput')
        expect(input).toBeTruthy()
        expect(input).toHaveProperty('value', 'My Account')
    })

    it('calls onRename with trimmed name when save is pressed', () => {
        render(<RenameAccountBottomSheet {...defaultProps} />)

        const input = screen.getByTestId('PWInput')
        fireEvent.change(input, { target: { value: '  New Name  ' } })

        const saveButton = screen.getByText('account_options.rename_save')
        fireEvent.click(saveButton)

        expect(defaultProps.onRename).toHaveBeenCalledWith('New Name')
    })

    it('does not call onRename when name is empty', () => {
        render(<RenameAccountBottomSheet {...defaultProps} />)

        const input = screen.getByTestId('PWInput')
        fireEvent.change(input, { target: { value: '   ' } })

        const saveButton = screen.getByText('account_options.rename_save')
        fireEvent.click(saveButton)

        expect(defaultProps.onRename).not.toHaveBeenCalled()
    })

    it('disables save button when name is empty', () => {
        render(<RenameAccountBottomSheet {...defaultProps} />)

        const input = screen.getByTestId('PWInput')
        fireEvent.change(input, { target: { value: '' } })

        const saveButton = screen.getByText('account_options.rename_save')
        expect(saveButton.closest('button')).toHaveProperty('disabled', true)
    })

    it('calls onClose when close icon is pressed', () => {
        render(<RenameAccountBottomSheet {...defaultProps} />)

        const closeIcon = screen.getByTestId('icon-cross')
        fireEvent.click(closeIcon)

        expect(defaultProps.onClose).toHaveBeenCalled()
    })
})

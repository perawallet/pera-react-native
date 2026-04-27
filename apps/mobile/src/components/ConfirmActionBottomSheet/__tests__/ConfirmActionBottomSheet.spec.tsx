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

import { fireEvent, render, screen } from '@test-utils/render'
import { describe, it, expect, vi } from 'vitest'
import { ConfirmActionBottomSheet } from '../ConfirmActionBottomSheet'

describe('ConfirmActionBottomSheet', () => {
    const baseProps = {
        isVisible: true,
        title: 'Delete contact',
        message: 'Are you sure you want to delete this contact?',
        confirmLabel: 'Yes, delete contact',
        cancelLabel: 'Keep it',
    }

    it('renders the title, message and actions when visible', () => {
        render(
            <ConfirmActionBottomSheet
                {...baseProps}
                onClose={vi.fn()}
                onConfirm={vi.fn()}
            />,
        )
        expect(screen.getByText(baseProps.title)).toBeTruthy()
        expect(screen.getByText(baseProps.message)).toBeTruthy()
        expect(screen.getByText(baseProps.confirmLabel)).toBeTruthy()
        expect(screen.getByText(baseProps.cancelLabel)).toBeTruthy()
    })

    it('calls onConfirm when the confirm button is pressed', () => {
        const onConfirm = vi.fn()
        render(
            <ConfirmActionBottomSheet
                {...baseProps}
                onClose={vi.fn()}
                onConfirm={onConfirm}
            />,
        )
        fireEvent.click(screen.getByText(baseProps.confirmLabel))
        expect(onConfirm).toHaveBeenCalledTimes(1)
    })

    it('calls onClose when the cancel button is pressed', () => {
        const onClose = vi.fn()
        render(
            <ConfirmActionBottomSheet
                {...baseProps}
                onClose={onClose}
                onConfirm={vi.fn()}
            />,
        )
        fireEvent.click(screen.getByText(baseProps.cancelLabel))
        expect(onClose).toHaveBeenCalledTimes(1)
    })
})

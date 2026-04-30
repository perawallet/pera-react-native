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
import { PassphraseAcknowledgeBottomSheet } from '../PassphraseAcknowledgeBottomSheet'

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({
        t: (key: string) => key,
    }),
}))

const TEST_ID = 'passphrase_acknowledge_bottom_sheet'

describe('PassphraseAcknowledgeBottomSheet', () => {
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
            <PassphraseAcknowledgeBottomSheet
                {...defaultProps}
                isVisible={false}
            />,
        )
        expect(
            screen.queryByText('view_passphrase.acknowledge.title'),
        ).toBeNull()
    })

    it('renders title, description, all four rows, and action buttons', () => {
        render(<PassphraseAcknowledgeBottomSheet {...defaultProps} />)

        expect(
            screen.getByText('view_passphrase.acknowledge.title'),
        ).toBeTruthy()
        expect(
            screen.getByText('view_passphrase.acknowledge.description'),
        ).toBeTruthy()
        expect(
            screen.getByText('view_passphrase.acknowledge.row_screen'),
        ).toBeTruthy()
        expect(
            screen.getByText('view_passphrase.acknowledge.row_share'),
        ).toBeTruthy()
        expect(
            screen.getByText('view_passphrase.acknowledge.row_lose'),
        ).toBeTruthy()
        expect(
            screen.getByText('view_passphrase.acknowledge.row_pera'),
        ).toBeTruthy()
        expect(
            screen.getByText('view_passphrase.acknowledge.cta_reveal'),
        ).toBeTruthy()
        expect(
            screen.getByText('view_passphrase.acknowledge.cta_cancel'),
        ).toBeTruthy()
    })

    it('does not call onConfirm when reveal is pressed and not all rows are checked', () => {
        render(<PassphraseAcknowledgeBottomSheet {...defaultProps} />)

        fireEvent.click(screen.getByTestId(`${TEST_ID}_reveal`))

        expect(defaultProps.onConfirm).not.toHaveBeenCalled()
    })

    it('calls onConfirm only after all four rows have been toggled', () => {
        render(<PassphraseAcknowledgeBottomSheet {...defaultProps} />)

        fireEvent.click(screen.getByTestId(`${TEST_ID}_row_0`))
        fireEvent.click(screen.getByTestId(`${TEST_ID}_row_1`))
        fireEvent.click(screen.getByTestId(`${TEST_ID}_row_2`))
        fireEvent.click(screen.getByTestId(`${TEST_ID}_reveal`))
        expect(defaultProps.onConfirm).not.toHaveBeenCalled()

        fireEvent.click(screen.getByTestId(`${TEST_ID}_row_3`))
        fireEvent.click(screen.getByTestId(`${TEST_ID}_reveal`))
        expect(defaultProps.onConfirm).toHaveBeenCalledTimes(1)
    })

    it('calls onClose when cancel is pressed', () => {
        render(<PassphraseAcknowledgeBottomSheet {...defaultProps} />)

        fireEvent.click(screen.getByTestId(`${TEST_ID}_cancel`))

        expect(defaultProps.onClose).toHaveBeenCalled()
    })
})

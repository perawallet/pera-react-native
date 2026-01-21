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

import { render, fireEvent } from '@test-utils/render'
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import { PinEditView } from '../PinEditView'
import { usePinCode, useBiometrics } from '@perawallet/wallet-core-security'

vi.mock('@perawallet/wallet-core-security', () => ({
    usePinCode: vi.fn(),
    useBiometrics: vi.fn(),
    PIN_LENGTH: 4,
}))

describe('PinEditView', () => {
    const mockOnSuccess = vi.fn()
    const mockOnClose = vi.fn()

    beforeEach(() => {
        vi.clearAllMocks()
        ;(usePinCode as Mock).mockReturnValue({
            savePin: vi.fn(),
            verifyPin: vi.fn(),
            handleFailedAttempt: vi.fn(),
            resetFailedAttempts: vi.fn(),
            isLockedOut: false,
        })
        ;(useBiometrics as Mock).mockReturnValue({
            checkBiometricsEnabled: vi.fn().mockResolvedValue(false),
            authenticateWithBiometrics: vi.fn(),
        })
    })

    it('renders when mode is setup', () => {
        const { getByText } = render(
            <PinEditView
                mode='setup'
                onSuccess={mockOnSuccess}
                onClose={mockOnClose}
            />,
        )

        expect(getByText('security.pin.setup_title')).toBeTruthy()
    })

    it('renders when mode is verify', () => {
        const { getByText } = render(
            <PinEditView
                mode='verify'
                onSuccess={mockOnSuccess}
                onClose={mockOnClose}
            />,
        )

        expect(getByText('security.pin.verify_title')).toBeTruthy()
    })

    it('renders when mode is confirm', () => {
        const { getByText } = render(
            <PinEditView
                mode='confirm'
                onSuccess={mockOnSuccess}
                onClose={mockOnClose}
            />,
        )

        expect(getByText('security.pin.confirm_title')).toBeTruthy()
    })

    it('renders when mode is change_old', () => {
        const { getByText } = render(
            <PinEditView
                mode='change_old'
                onSuccess={mockOnSuccess}
                onClose={mockOnClose}
            />,
        )

        expect(getByText('security.pin.change_old_title')).toBeTruthy()
    })

    it('renders numpad for PIN entry', () => {
        const { getByText } = render(
            <PinEditView
                mode='setup'
                onSuccess={mockOnSuccess}
                onClose={mockOnClose}
            />,
        )

        expect(getByText('1')).toBeTruthy()
        expect(getByText('2')).toBeTruthy()
        expect(getByText('3')).toBeTruthy()
    })

    it('calls onClose when close button is clicked', () => {
        const { getByTestId } = render(
            <PinEditView
                mode='setup'
                onSuccess={mockOnSuccess}
                onClose={mockOnClose}
            />,
        )

        const closeButton = getByTestId('close-button')
        fireEvent.click(closeButton)

        expect(mockOnClose).toHaveBeenCalled()
    })
})

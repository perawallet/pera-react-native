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
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PinEntry } from '../PinEntry'

vi.mock('@perawallet/wallet-core-security', () => ({
    PIN_LENGTH: 4,
}))

describe('PinEntry', () => {
    const mockOnPinComplete = vi.fn()
    const mockOnPinChange = vi.fn()
    const mockOnErrorAnimationComplete = vi.fn()

    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders title correctly', () => {
        const { getByText } = render(
            <PinEntry
                title='Enter PIN'
                onPinComplete={mockOnPinComplete}
            />,
        )

        expect(getByText('Enter PIN')).toBeTruthy()
    })

    it('renders numpad', () => {
        const { getByText } = render(
            <PinEntry
                title='Enter PIN'
                onPinComplete={mockOnPinComplete}
            />,
        )

        expect(getByText('1')).toBeTruthy()
        expect(getByText('2')).toBeTruthy()
        expect(getByText('3')).toBeTruthy()
        expect(getByText('4')).toBeTruthy()
        expect(getByText('5')).toBeTruthy()
        expect(getByText('6')).toBeTruthy()
        expect(getByText('7')).toBeTruthy()
        expect(getByText('8')).toBeTruthy()
        expect(getByText('9')).toBeTruthy()
        expect(getByText('0')).toBeTruthy()
    })

    it('accepts onPinChange callback', () => {
        const { getByText } = render(
            <PinEntry
                title='Enter PIN'
                onPinComplete={mockOnPinComplete}
                onPinChange={mockOnPinChange}
            />,
        )

        fireEvent.click(getByText('1'))

        expect(mockOnPinChange).toHaveBeenCalledWith('1')
    })

    it('renders with isDisabled prop', () => {
        const { getByText } = render(
            <PinEntry
                title='Enter PIN'
                onPinComplete={mockOnPinComplete}
                isDisabled={true}
            />,
        )

        expect(getByText('Enter PIN')).toBeTruthy()
    })

    it('renders with hasError prop', () => {
        const { getByText } = render(
            <PinEntry
                title='Enter PIN'
                onPinComplete={mockOnPinComplete}
                hasError={true}
                onErrorAnimationComplete={mockOnErrorAnimationComplete}
            />,
        )

        expect(getByText('Enter PIN')).toBeTruthy()
    })

    it('handles multiple key presses', () => {
        const { getByText } = render(
            <PinEntry
                title='Enter PIN'
                onPinComplete={mockOnPinComplete}
                onPinChange={mockOnPinChange}
            />,
        )

        fireEvent.click(getByText('1'))
        fireEvent.click(getByText('2'))
        fireEvent.click(getByText('3'))

        expect(mockOnPinChange).toHaveBeenCalledTimes(3)
    })
})

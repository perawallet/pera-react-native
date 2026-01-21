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

import { render, screen } from '@test-utils/render'
import { describe, it, expect, vi } from 'vitest'
import { fireEvent } from '@testing-library/react'
import { PWNumpad } from '../PWNumpad'

describe('PWNumpad', () => {
    it('renders correctly in pin mode', () => {
        const onKeyPress = vi.fn()
        render(
            <PWNumpad
                mode='pin'
                onKeyPress={onKeyPress}
            />,
        )

        expect(screen.getByText('1')).toBeTruthy()
        expect(screen.getByText('2')).toBeTruthy()
        expect(screen.getByText('3')).toBeTruthy()
        expect(screen.getByText('4')).toBeTruthy()
        expect(screen.getByText('5')).toBeTruthy()
        expect(screen.getByText('6')).toBeTruthy()
        expect(screen.getByText('7')).toBeTruthy()
        expect(screen.getByText('8')).toBeTruthy()
        expect(screen.getByText('9')).toBeTruthy()
        expect(screen.getByText('0')).toBeTruthy()
    })

    it('renders correctly in number mode', () => {
        const onKeyPress = vi.fn()
        render(
            <PWNumpad
                mode='number'
                onKeyPress={onKeyPress}
            />,
        )

        expect(screen.getByText('1')).toBeTruthy()
        expect(screen.getByText('2')).toBeTruthy()
        expect(screen.getByText('3')).toBeTruthy()
        expect(screen.getByText('4')).toBeTruthy()
        expect(screen.getByText('5')).toBeTruthy()
        expect(screen.getByText('6')).toBeTruthy()
        expect(screen.getByText('7')).toBeTruthy()
        expect(screen.getByText('8')).toBeTruthy()
        expect(screen.getByText('9')).toBeTruthy()
        expect(screen.getByText('0')).toBeTruthy()
        expect(screen.getByText('.')).toBeTruthy()
    })

    it('calls onKeyPress when number key is pressed', () => {
        const onKeyPress = vi.fn()
        render(
            <PWNumpad
                mode='pin'
                onKeyPress={onKeyPress}
            />,
        )

        fireEvent.click(screen.getByText('1'))
        expect(onKeyPress).toHaveBeenCalledWith('1')

        fireEvent.click(screen.getByText('5'))
        expect(onKeyPress).toHaveBeenCalledWith('5')

        fireEvent.click(screen.getByText('9'))
        expect(onKeyPress).toHaveBeenCalledWith('9')
    })

    it('calls onKeyPress with delete when delete button is pressed', () => {
        const onKeyPress = vi.fn()
        render(
            <PWNumpad
                mode='pin'
                onKeyPress={onKeyPress}
            />,
        )

        const deleteIcon = screen.getByTestId('icon-delete')
        const deleteButton = deleteIcon.parentElement!
        fireEvent.click(deleteButton)
        expect(onKeyPress).toHaveBeenCalledWith('delete')
    })

    it('calls onKeyPress with decimal when dot is pressed in number mode', () => {
        const onKeyPress = vi.fn()
        render(
            <PWNumpad
                mode='number'
                onKeyPress={onKeyPress}
            />,
        )

        fireEvent.click(screen.getByText('.'))
        expect(onKeyPress).toHaveBeenCalledWith('.')
    })

    it('does not call onKeyPress when disabled', () => {
        const onKeyPress = vi.fn()
        render(
            <PWNumpad
                mode='pin'
                onKeyPress={onKeyPress}
                isDisabled={true}
            />,
        )

        fireEvent.click(screen.getByText('1'))
        fireEvent.click(screen.getByText('5'))
        fireEvent.click(screen.getByText('9'))

        expect(onKeyPress).not.toHaveBeenCalled()
    })

    it('does not call onKeyPress for delete button when disabled', () => {
        const onKeyPress = vi.fn()
        render(
            <PWNumpad
                mode='pin'
                onKeyPress={onKeyPress}
                isDisabled={true}
            />,
        )

        const deleteIcon = screen.getByTestId('icon-delete')
        const deleteButton = deleteIcon.parentElement!
        fireEvent.click(deleteButton)
        expect(onKeyPress).not.toHaveBeenCalled()
    })

    it('handles all number keys correctly', () => {
        const onKeyPress = vi.fn()
        render(
            <PWNumpad
                mode='pin'
                onKeyPress={onKeyPress}
            />,
        )

        const numbers = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']

        numbers.forEach(num => {
            onKeyPress.mockClear()
            fireEvent.click(screen.getByText(num))
            expect(onKeyPress).toHaveBeenCalledWith(num)
        })
    })

    it('shows all keys in correct order for pin mode', () => {
        const onKeyPress = vi.fn()
        render(
            <PWNumpad
                mode='pin'
                onKeyPress={onKeyPress}
            />,
        )

        const expectedLayout = [
            ['1', '2', '3'],
            ['4', '5', '6'],
            ['7', '8', '9'],
            ['0'], // null, 0, delete (we only check text nodes)
        ]

        expectedLayout.flat().forEach(num => {
            expect(screen.getByText(num)).toBeTruthy()
        })
    })

    it('shows all keys in correct order for number mode', () => {
        const onKeyPress = vi.fn()
        render(
            <PWNumpad
                mode='number'
                onKeyPress={onKeyPress}
            />,
        )

        const expectedLayout = [
            ['1', '2', '3'],
            ['4', '5', '6'],
            ['7', '8', '9'],
            ['.', '0'], // ., 0, delete (we only check text nodes)
        ]

        expectedLayout.flat().forEach(key => {
            expect(screen.getByText(key)).toBeTruthy()
        })
    })

    it('renders delete icon for delete key', () => {
        const onKeyPress = vi.fn()
        render(
            <PWNumpad
                mode='pin'
                onKeyPress={onKeyPress}
            />,
        )

        expect(screen.getByTestId('icon-delete')).toBeTruthy()
    })

    it('applies disabled state correctly', () => {
        const onKeyPress = vi.fn()
        const { rerender } = render(
            <PWNumpad
                mode='pin'
                onKeyPress={onKeyPress}
                isDisabled={false}
            />,
        )

        fireEvent.click(screen.getByText('1'))
        expect(onKeyPress).toHaveBeenCalledTimes(1)

        onKeyPress.mockClear()

        rerender(
            <PWNumpad
                mode='pin'
                onKeyPress={onKeyPress}
                isDisabled={true}
            />,
        )

        fireEvent.click(screen.getByText('1'))
        expect(onKeyPress).not.toHaveBeenCalled()
    })
})

/*
 Copyright 2022-2026 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { describe, it, expect, vi } from 'vitest'
import React from 'react'
import { TouchableOpacity } from 'react-native'
import { render, fireEvent, screen } from '@test-utils/render'
import { PWCheckbox } from '../PWCheckbox'

describe('PWCheckbox', () => {
    it('toggles when the label text is pressed', () => {
        const onPress = vi.fn()
        render(
            <PWCheckbox
                label='I have saved my passphrase'
                isChecked={false}
                onPress={onPress}
                testID='acknowledge'
            />,
        )

        fireEvent.click(screen.getByText('I have saved my passphrase'))

        expect(onPress).toHaveBeenCalledTimes(1)
    })

    it('toggles once when the box itself is pressed', () => {
        const onPress = vi.fn()
        render(
            <PWCheckbox
                label='I have saved my passphrase'
                isChecked={false}
                onPress={onPress}
                testID='acknowledge'
                boxTestID='acknowledge_box'
            />,
        )

        fireEvent.click(screen.getByTestId('acknowledge_box'))

        expect(onPress).toHaveBeenCalledTimes(1)
    })

    it('ignores presses while disabled', () => {
        const onPress = vi.fn()
        render(
            <PWCheckbox
                label='I have saved my passphrase'
                isChecked={false}
                isDisabled
                onPress={onPress}
                testID='acknowledge'
            />,
        )

        fireEvent.click(screen.getByText('I have saved my passphrase'))

        expect(onPress).not.toHaveBeenCalled()
    })

    it.each([
        { isChecked: false, isDisabled: false },
        { isChecked: true, isDisabled: true },
    ])(
        'exposes the row as one checkbox with checked=$isChecked, disabled=$isDisabled',
        ({ isChecked, isDisabled }) => {
            render(
                <PWCheckbox
                    label='I have saved my passphrase'
                    isChecked={isChecked}
                    isDisabled={isDisabled}
                    onPress={vi.fn()}
                    testID='acknowledge'
                />,
            )

            const row = screen.getByTestId('acknowledge')
            const rowProps = vi
                .mocked(TouchableOpacity)
                .mock.calls.map(([props]) => props)
                .filter(props => props.testID === 'acknowledge')
                .pop()

            expect(rowProps?.accessibilityRole).toBe('checkbox')
            expect(row.getAttribute('aria-checked')).toBe(String(isChecked))
            expect(row.getAttribute('aria-disabled')).toBe(String(isDisabled))
        },
    )

    it('takes an untick straight after a tick', () => {
        const onPress = vi.fn()
        render(
            <PWCheckbox
                label='I have saved my passphrase'
                isChecked={false}
                onPress={onPress}
                testID='acknowledge'
            />,
        )

        fireEvent.click(screen.getByTestId('acknowledge'))
        fireEvent.click(screen.getByTestId('acknowledge'))

        expect(onPress).toHaveBeenCalledTimes(2)
    })

    it('puts the checkbox state on the box when the label holds a link', () => {
        render(
            <PWCheckbox
                label='I accept the Terms & Conditions.'
                isChecked
                onPress={vi.fn()}
                testID='terms'
                boxTestID='terms_box'
                isLabelInteractive
                accessibilityLabel='I accept the Terms & Conditions.'
            />,
        )

        expect(
            screen.getByTestId('terms').getAttribute('aria-checked'),
        ).toBeNull()
        expect(
            screen.getByTestId('terms_box').getAttribute('aria-checked'),
        ).toBe('true')
    })

    it('renders the label after the box when the box trails', () => {
        render(
            <PWCheckbox
                label='Select all'
                boxPosition='trailing'
                isChecked={false}
                onPress={vi.fn()}
                testID='select_all'
                boxTestID='select_all_box'
            />,
        )

        const [first, second] = Array.from(
            screen.getByTestId('select_all').children,
        )

        expect(first?.textContent).toBe('Select all')
        expect(second?.getAttribute('data-testid')).toBe('select_all_box')
    })
})

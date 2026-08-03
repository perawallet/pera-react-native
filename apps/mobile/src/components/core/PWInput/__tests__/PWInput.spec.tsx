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

import { Platform } from 'react-native'
import { render, fireEvent, screen } from '@test-utils/render'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { PWInput } from '../PWInput'

const originalOS = Platform.OS

describe('PWInput', () => {
    it('renders correctly', () => {
        render(<PWInput placeholder='Enter text' />)
        expect(screen.getByPlaceholderText('Enter text')).toBeTruthy()
    })

    it('calls onChangeText when text changes', () => {
        render(
            <PWInput
                value='test'
                onChangeText={() => {}}
            />,
        )
    })

    // Retrying with simpler test case for input
    it('handles input events', () => {
        const onChangeText = vi.fn()
        render(
            <PWInput
                placeholder='test'
                onChangeText={onChangeText}
            />,
        )
        fireEvent.change(screen.getByPlaceholderText('test'), {
            target: { value: 'hello' },
        })
        expect(onChangeText).toHaveBeenCalledWith('hello')
    })

    // `isDisabled` is deliberately untested here: the suite mocks @rneui's
    // Input with a plain <input> that wires onChange unconditionally
    // (vitest.setup.ts), so neither `editable` nor the dim style is observable.
    // The locked-field behaviour is covered where it has meaning: the
    // personal-details screen spec asserts the isXLocked flags.

    describe('showVisibilityToggle', () => {
        it('wires the reveal toggle as a right icon only while focused', () => {
            render(
                <PWInput
                    placeholder='pw'
                    secureTextEntry
                    showVisibilityToggle
                    testID='pw'
                />,
            )
            const input = screen.getByPlaceholderText('pw')

            // No toggle until the field is focused.
            expect(input.getAttribute('righticon')).toBeNull()

            fireEvent.focus(input)
            expect(
                screen.getByPlaceholderText('pw').getAttribute('righticon'),
            ).toBeTruthy()

            // Blurring hides it again.
            fireEvent.blur(input)
            expect(
                screen.getByPlaceholderText('pw').getAttribute('righticon'),
            ).toBeNull()
        })

        it('wires no toggle when showVisibilityToggle is not set', () => {
            render(
                <PWInput
                    placeholder='plain'
                    secureTextEntry
                    testID='plain'
                />,
            )
            fireEvent.focus(screen.getByPlaceholderText('plain'))

            expect(
                screen.getByPlaceholderText('plain').getAttribute('righticon'),
            ).toBeNull()
        })

        describe('on web', () => {
            afterEach(() => {
                Platform.OS = originalOS
            })

            it('keeps the visibility toggle mounted regardless of focus', () => {
                Platform.OS = 'web'
                render(
                    <PWInput
                        placeholder='pw-web'
                        value='secret'
                        onChangeText={() => {}}
                        secureTextEntry
                        showVisibilityToggle
                    />,
                )
                const input = screen.getByPlaceholderText('pw-web')
                expect(input.getAttribute('righticon')).toBeTruthy()

                // Unlike the non-web case, blurring must not hide the toggle.
                fireEvent.blur(input)
                expect(
                    screen
                        .getByPlaceholderText('pw-web')
                        .getAttribute('righticon'),
                ).toBeTruthy()
            })
        })
    })

    describe('minimumFontScale default', () => {
        it('defaults minimumFontScale to 0.5 when adjustsFontSizeToFit is true', () => {
            render(
                <PWInput
                    adjustsFontSizeToFit
                    placeholder='test'
                />,
            )
            const element = screen.getByPlaceholderText('test')
            expect(element.getAttribute('minimumfontscale')).toBe('0.5')
        })

        it('allows overriding minimumFontScale when adjustsFontSizeToFit is true', () => {
            render(
                <PWInput
                    adjustsFontSizeToFit
                    minimumFontScale={0.7}
                    placeholder='test-override'
                />,
            )
            const element = screen.getByPlaceholderText('test-override')
            expect(element.getAttribute('minimumfontscale')).toBe('0.7')
        })

        it('does not set minimumFontScale when adjustsFontSizeToFit is not set', () => {
            render(<PWInput placeholder='test-no-adjust' />)
            const element = screen.getByPlaceholderText('test-no-adjust')
            expect(element.getAttribute('minimumfontscale')).toBeNull()
        })
    })

    describe('showErrorOnBlur', () => {
        it('withholds the error until the field has been blurred once', () => {
            render(
                <PWInput
                    placeholder='field'
                    showErrorOnBlur
                    renderErrorMessage
                    errorMessage='Required'
                />,
            )
            const input = screen.getByPlaceholderText('field')

            // Suppressed before the first blur, even though errorMessage is set.
            expect(input.getAttribute('errormessage')).toBeNull()

            fireEvent.blur(input)
            expect(
                screen
                    .getByPlaceholderText('field')
                    .getAttribute('errormessage'),
            ).toBe('Required')
        })

        it('shows the error immediately when showErrorOnBlur is not set', () => {
            render(
                <PWInput
                    placeholder='plain-err'
                    renderErrorMessage
                    errorMessage='Required'
                />,
            )
            expect(
                screen
                    .getByPlaceholderText('plain-err')
                    .getAttribute('errormessage'),
            ).toBe('Required')
        })
    })
})

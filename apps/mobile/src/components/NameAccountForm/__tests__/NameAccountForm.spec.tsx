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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ReactNode } from 'react'
import { Keyboard } from 'react-native'
import { render, fireEvent, screen } from '@test-utils/render'
import { NameAccountForm, type NameAccountFormProps } from '../NameAccountForm'

// RNE's <Input> doesn't mount its `rightIcon` under react-native-web/jsdom, so
// the clear button never reaches the DOM through the real PWInput. Stub the
// layout components (importing the full barrel pulls in react-native-ratings,
// which vite can't transform here) but keep the real PWTouchableIcon so the
// keyboard-dismiss behavior is exercised end to end.
vi.mock('@components/core', async () => {
    const { PWTouchableIcon } = await vi.importActual<
        typeof import('@components/core/PWTouchableIcon')
    >('@components/core/PWTouchableIcon')

    const Passthrough = ({ children }: { children?: ReactNode }) => (
        <div>{children}</div>
    )

    return {
        PWScreen: ({
            children,
            footer,
        }: {
            children?: ReactNode
            footer?: ReactNode
        }) => (
            <div>
                {children}
                {footer}
            </div>
        ),
        PWView: Passthrough,
        PWText: Passthrough,
        PWButton: () => <button type='button' />,
        PWLoadingOverlay: () => null,
        PWInput: ({ rightIcon }: { rightIcon?: ReactNode }) => (
            <div>{rightIcon}</div>
        ),
        PWTouchableIcon,
    }
})

const renderForm = (props: Partial<NameAccountFormProps> = {}) =>
    render(
        <NameAccountForm
            title='Name account'
            description='Give it a name'
            finishButtonTitle='Finish'
            loadingTitle='Saving'
            value='My Account'
            onChangeText={vi.fn()}
            onFinish={vi.fn()}
            isLoading={false}
            {...props}
        />,
    )

describe('NameAccountForm', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('clears the value when the clear button is pressed', () => {
        const onChangeText = vi.fn()
        renderForm({ onChangeText })

        fireEvent.click(screen.getByTestId('name_account_clear_button'))

        expect(onChangeText).toHaveBeenCalledWith('')
    })

    // Regression: the clear button used to inherit PWTouchableOpacity's default
    // dismissKeyboardOnPress=true, which blurred the field and dropped the keyboard.
    it('keeps the keyboard up when the clear button is pressed', () => {
        renderForm()

        fireEvent.click(screen.getByTestId('name_account_clear_button'))

        expect(Keyboard.dismiss).not.toHaveBeenCalled()
    })

    it('hides the clear button when the value is empty', () => {
        renderForm({ value: '' })

        expect(screen.queryByTestId('name_account_clear_button')).toBeNull()
    })
})

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
import { render, screen, fireEvent } from '@test-utils/render'
import { PWCodeInput } from '../PWCodeInput'

const change = (testID: string, value: string) =>
    fireEvent.change(screen.getByTestId(testID), { target: { value } })

describe('PWCodeInput', () => {
    it('strips non-digits before reporting the value', () => {
        const onChangeText = vi.fn()
        render(
            <PWCodeInput
                value=''
                onChangeText={onChangeText}
                length={6}
                testID='code'
            />,
        )

        change('code', '12a3')

        expect(onChangeText).toHaveBeenCalledWith('123')
    })

    it('caps the value at `length` even for over-length input (paste/autofill)', () => {
        const onChangeText = vi.fn()
        render(
            <PWCodeInput
                value=''
                onChangeText={onChangeText}
                length={6}
                testID='code'
            />,
        )

        change('code', '1234567')

        expect(onChangeText).toHaveBeenCalledWith('123456')
    })

    it('fires onComplete once when the value reaches `length`', () => {
        const onComplete = vi.fn()
        render(
            <PWCodeInput
                value=''
                onChangeText={vi.fn()}
                length={6}
                onComplete={onComplete}
                testID='code'
            />,
        )

        change('code', '123456')

        expect(onComplete).toHaveBeenCalledTimes(1)
        expect(onComplete).toHaveBeenCalledWith('123456')
    })

    it('does not fire onComplete before the value is full', () => {
        const onComplete = vi.fn()
        render(
            <PWCodeInput
                value=''
                onChangeText={vi.fn()}
                length={6}
                onComplete={onComplete}
                testID='code'
            />,
        )

        change('code', '123')

        expect(onComplete).not.toHaveBeenCalled()
    })

    it('renders the entered digits and shows the error message when set', () => {
        render(
            <PWCodeInput
                value='12'
                onChangeText={vi.fn()}
                length={6}
                errorMessage='The code is wrong'
                testID='code'
            />,
        )

        expect(screen.getByText('1')).toBeTruthy()
        expect(screen.getByText('2')).toBeTruthy()
        expect(screen.getByTestId('code-error')).toBeTruthy()
    })

    it('omits the error node when there is no error', () => {
        render(
            <PWCodeInput
                value=''
                onChangeText={vi.fn()}
                length={6}
                testID='code'
            />,
        )

        expect(screen.queryByTestId('code-error')).toBeNull()
    })
})

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
import React from 'react'
import { Keyboard } from 'react-native'
import { render, fireEvent, screen } from '@test-utils/render'
import { PWIcon } from '@components/core/PWIcon'
import { PWTouchableIcon } from '../PWTouchableIcon'

vi.mock('@components/core/PWIcon', () => ({
    PWIcon: vi.fn(() => <div data-testid='pw-icon' />),
}))

describe('PWTouchableIcon', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('calls onPress when pressed', () => {
        const onPress = vi.fn()
        render(
            <PWTouchableIcon
                name='cross'
                onPress={onPress}
            />,
        )

        fireEvent.click(screen.getByTestId('pw-icon'))
        expect(onPress).toHaveBeenCalledTimes(1)
    })

    it('forwards icon props to PWIcon', () => {
        const onPress = vi.fn()
        render(
            <PWTouchableIcon
                name='check'
                size='lg'
                variant='secondary'
                onPress={onPress}
            />,
        )

        expect(PWIcon).toHaveBeenCalledWith(
            expect.objectContaining({
                name: 'check',
                size: 'lg',
                variant: 'secondary',
            }),
            undefined,
        )
    })

    it('forwards dismissKeyboardOnPress to PWTouchableOpacity', () => {
        const onPress = vi.fn()
        render(
            <PWTouchableIcon
                name='eye'
                onPress={onPress}
                dismissKeyboardOnPress={false}
            />,
        )

        fireEvent.click(screen.getByTestId('pw-icon'))
        expect(Keyboard.dismiss).not.toHaveBeenCalled()
    })

    it('does not pass onPress to PWIcon', () => {
        const onPress = vi.fn()
        render(
            <PWTouchableIcon
                name='cross'
                onPress={onPress}
            />,
        )

        expect(PWIcon).toHaveBeenCalledWith(
            expect.not.objectContaining({
                onPress: expect.anything(),
            }),
            undefined,
        )
    })
})

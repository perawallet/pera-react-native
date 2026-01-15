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

import { describe, it, expect, vi } from 'vitest'
import React from 'react'
import { render, fireEvent, screen } from '@test-utils/render'
import { Text } from 'react-native'
import PWHeader from '../PWHeader'

describe('PWHeader', () => {
    it('renders the title correctly', () => {
        render(<PWHeader title='Page Title' />)
        expect(screen.getByText('Page Title')).toBeTruthy()
    })

    it('renders children correctly', () => {
        render(
            <PWHeader>
                <Text>Custom Child</Text>
            </PWHeader>,
        )
        expect(screen.getByText('Custom Child')).toBeTruthy()
    })

    it('calls onLeftPress when left icon is clicked', () => {
        const onLeftPress = vi.fn()
        render(
            <PWHeader
                leftIcon='chevron-left'
                onLeftPress={onLeftPress}
            />,
        )

        fireEvent.click(screen.getByTestId('icon-chevron-left'))
        expect(onLeftPress).toHaveBeenCalledTimes(1)
    })

    it('calls onRightPress when right icon is clicked', () => {
        const onRightPress = vi.fn()
        render(
            <PWHeader
                rightIcon='plus'
                onRightPress={onRightPress}
            />,
        )

        fireEvent.click(screen.getByTestId('icon-plus'))
        expect(onRightPress).toHaveBeenCalledTimes(1)
    })
})

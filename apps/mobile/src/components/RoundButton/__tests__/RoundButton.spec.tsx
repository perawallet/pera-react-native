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
import RoundButton from '../RoundButton'

describe('RoundButton', () => {
    it('renders title if provided', () => {
        render(
            <RoundButton
                icon='plus'
                title='Add'
            />,
        )
        expect(screen.getByText('Add')).toBeTruthy()
    })

    it('calls onPress when clicked', () => {
        const onPress = vi.fn()
        render(
            <RoundButton
                icon='plus'
                onPress={onPress}
            />,
        )

        // Find the icon (which is rendered as a TouchableOpacity in our mock)
        fireEvent.click(screen.getByTestId('icon-plus'))
        expect(onPress).toHaveBeenCalledTimes(1)
    })
})

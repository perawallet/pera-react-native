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
import PanelButton from '../PanelButton'

describe('PanelButton', () => {
    it('calls onPress when clicked', () => {
        const onPress = vi.fn()
        render(
            <PanelButton
                title='Click Me'
                titleWeight='h4'
                onPress={onPress}
            />,
        )

        fireEvent.click(screen.getByText('Click Me'))
        expect(onPress).toHaveBeenCalledTimes(1)
    })

    it('renders the title correctly', () => {
        render(
            <PanelButton
                title='Button Title'
                titleWeight='h4'
                onPress={() => {}}
            />,
        )

        expect(screen.getByText('Button Title')).toBeTruthy()
    })
})

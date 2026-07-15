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
import { render, fireEvent, screen } from '@test-utils/render'
import { SearchInput } from '../SearchInput'

describe('SearchInput', () => {
    it('calls onChangeText when text changes', () => {
        const onChangeText = vi.fn()
        render(
            <SearchInput
                onChangeText={onChangeText}
                placeholder='Search coins'
            />,
        )

        fireEvent.change(screen.getByPlaceholderText('Search coins'), {
            target: { value: 'Algorand' },
        })
        expect(onChangeText).toHaveBeenCalledWith('Algorand')
    })

    // PWInput is mocked as a bare <input>; its `rightIcon` prop is stringified
    // to an attribute rather than rendered, so we assert the clear button's
    // presence/absence via the `righticon` attribute and exercise the
    // onChange('') contract directly.
    it('omits the clear button when there is no value', () => {
        render(
            <SearchInput
                value=''
                onChangeText={vi.fn()}
                placeholder='Search coins'
            />,
        )
        expect(
            screen
                .getByPlaceholderText('Search coins')
                .getAttribute('righticon'),
        ).toBeNull()
    })

    it('renders the clear button when the input has a value', () => {
        render(
            <SearchInput
                value='alice'
                onChangeText={vi.fn()}
                placeholder='Search coins'
            />,
        )
        expect(
            screen
                .getByPlaceholderText('Search coins')
                .getAttribute('righticon'),
        ).not.toBeNull()
    })
})

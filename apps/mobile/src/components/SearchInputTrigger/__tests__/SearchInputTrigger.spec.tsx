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

import { render, screen, fireEvent } from '@test-utils/render'
import { describe, it, expect, vi } from 'vitest'
import { PWText } from '@components/core'
import { SearchInputTrigger } from '../SearchInputTrigger'

describe('SearchInputTrigger', () => {
    it('forwards taps to onPress', () => {
        const onPress = vi.fn()
        render(
            <SearchInputTrigger
                onPress={onPress}
                placeholder='Search'
                testID='search-trigger'
            />,
        )

        fireEvent.click(screen.getByTestId('search-trigger'))

        expect(onPress).toHaveBeenCalledTimes(1)
    })

    it('renders a custom input display when provided', () => {
        const CustomInput = () => <PWText testID='custom-input'>custom</PWText>

        render(
            <SearchInputTrigger
                onPress={vi.fn()}
                SearchInputComponent={CustomInput}
            />,
        )

        expect(screen.getByTestId('custom-input')).toBeTruthy()
    })
})

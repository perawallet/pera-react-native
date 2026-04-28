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
import { render, fireEvent, screen } from '@test-utils/render'
import { FindAnotherWalletRow } from '../FindAnotherWalletRow'

describe('FindAnotherWalletRow', () => {
    it('calls onPress when tapped in idle state', () => {
        const onPress = vi.fn()
        render(
            <FindAnotherWalletRow
                onPress={onPress}
                isLoading={false}
                label='Find another wallet'
            />,
        )

        fireEvent.click(screen.getByText('Find another wallet'))

        expect(onPress).toHaveBeenCalledTimes(1)
    })

    it('does not call onPress while loading', () => {
        const onPress = vi.fn()
        render(
            <FindAnotherWalletRow
                onPress={onPress}
                isLoading={true}
                label='Find another wallet'
            />,
        )

        fireEvent.click(screen.getByText('Find another wallet'))

        expect(onPress).not.toHaveBeenCalled()
    })

    it('renders an ActivityIndicator when loading', () => {
        render(
            <FindAnotherWalletRow
                onPress={vi.fn()}
                isLoading={true}
                label='Find another wallet'
                testID='find-another-row'
            />,
        )

        expect(screen.getByTestId('find-another-row-spinner')).toBeTruthy()
    })
})

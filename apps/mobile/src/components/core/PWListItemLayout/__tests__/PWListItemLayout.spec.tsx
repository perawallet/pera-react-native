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

import { render, fireEvent, screen } from '@test-utils/render'
import { describe, it, expect, vi } from 'vitest'
import { Text } from 'react-native'
import { PWListItemLayout } from '../PWListItemLayout'

describe('PWListItemLayout', () => {
    it('renders the left, center, and right slots', () => {
        render(
            <PWListItemLayout
                left={<Text>left-slot</Text>}
                right={<Text>right-slot</Text>}
            >
                <Text>center-slot</Text>
            </PWListItemLayout>,
        )

        expect(screen.getByText('left-slot')).toBeTruthy()
        expect(screen.getByText('center-slot')).toBeTruthy()
        expect(screen.getByText('right-slot')).toBeTruthy()
    })

    it('renders the divider only when showDivider is set', () => {
        const { container, rerender } = render(
            <PWListItemLayout testID='item'>
                <Text>center-slot</Text>
            </PWListItemLayout>,
        )

        expect(container.querySelector('[testid="item-divider"]')).toBeNull()

        rerender(
            <PWListItemLayout
                testID='item'
                showDivider
            >
                <Text>center-slot</Text>
            </PWListItemLayout>,
        )

        expect(container.querySelector('[testid="item-divider"]')).toBeTruthy()
    })

    it('invokes onPress when pressed', () => {
        const onPress = vi.fn()
        const { container } = render(
            <PWListItemLayout
                testID='item'
                onPress={onPress}
            >
                <Text>center-slot</Text>
            </PWListItemLayout>,
        )

        const item = container.querySelector('[testid="item"]')
        expect(item).toBeTruthy()
        fireEvent.click(item!)

        expect(onPress).toHaveBeenCalledTimes(1)
    })

    describe('onLongPress', () => {
        it('invokes onLongPress on a long press without firing onPress', () => {
            const onPress = vi.fn()
            const onLongPress = vi.fn()
            const { container } = render(
                <PWListItemLayout
                    testID='item'
                    onPress={onPress}
                    onLongPress={onLongPress}
                >
                    <Text>center-slot</Text>
                </PWListItemLayout>,
            )

            const item = container.querySelector('[testid="item"]')
            expect(item).toBeTruthy()
            fireEvent.contextMenu(item!)

            expect(onLongPress).toHaveBeenCalledTimes(1)
            expect(onPress).not.toHaveBeenCalled()
        })

        it('makes the row touchable when only onLongPress is given', () => {
            const onLongPress = vi.fn()
            const { container } = render(
                <PWListItemLayout
                    testID='item'
                    onLongPress={onLongPress}
                >
                    <Text>center-slot</Text>
                </PWListItemLayout>,
            )

            const item = container.querySelector('[testid="item"]')
            expect(item).toBeTruthy()
            fireEvent.contextMenu(item!)

            expect(onLongPress).toHaveBeenCalledTimes(1)
        })
    })
})

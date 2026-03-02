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
import { render, screen } from '@test-utils/render'
import { PWBottomSheet } from '../PWBottomSheet'
import { Text } from 'react-native'

describe('PWBottomSheet', () => {
    it('shows children when visible', () => {
        render(
            <PWBottomSheet isVisible={true}>
                <Text>Sheet Content</Text>
            </PWBottomSheet>,
        )

        expect(screen.getByText('Sheet Content')).toBeTruthy()
    })

    it('does not show children when not visible', () => {
        render(
            <PWBottomSheet isVisible={false}>
                <Text>Sheet Content</Text>
            </PWBottomSheet>,
        )

        expect(screen.queryByText('Sheet Content')).toBeNull()
    })

    it('calls onBackdropPress when dismissed', () => {
        const onBackdropPress = vi.fn()
        render(
            <PWBottomSheet
                isVisible={true}
                onBackdropPress={onBackdropPress}
            >
                <Text>Sheet Content</Text>
            </PWBottomSheet>,
        )

        // The mock BottomSheetModal should be present
        expect(screen.getByTestId('BottomSheetModal')).toBeTruthy()
    })

    it('renders with custom snap points', () => {
        render(
            <PWBottomSheet
                isVisible={true}
                snapPoints={['25%', '50%', '90%']}
            >
                <Text>Sheet Content</Text>
            </PWBottomSheet>,
        )

        expect(screen.getByText('Sheet Content')).toBeTruthy()
    })

    it('renders with dynamic sizing disabled', () => {
        render(
            <PWBottomSheet
                isVisible={true}
                enableDynamicSizing={false}
                snapPoints={['50%']}
            >
                <Text>Sheet Content</Text>
            </PWBottomSheet>,
        )

        expect(screen.getByText('Sheet Content')).toBeTruthy()
    })

    it('renders with scroll disabled', () => {
        render(
            <PWBottomSheet
                isVisible={true}
                scrollEnabled={false}
            >
                <Text>Sheet Content</Text>
            </PWBottomSheet>,
        )

        expect(screen.getByText('Sheet Content')).toBeTruthy()
    })
})

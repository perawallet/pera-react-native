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

import React from 'react'
import { Text, View } from 'react-native'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@test-utils/render'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { BottomTabBarHeightContext } from '@react-navigation/bottom-tabs'

import { PWScreen } from '../PWScreen'
import { usePWScreenInsets } from '../usePWScreenInsets'
import { PWInBottomSheetContext } from '../../PWBottomSheet/inSheetContext'

describe('PWScreen', () => {
    beforeEach(() => {
        vi.mocked(useSafeAreaInsets).mockReturnValue({
            top: 47,
            bottom: 34,
            left: 0,
            right: 0,
        })
    })

    it('renders the body inside a scroll container by default', () => {
        render(
            <PWScreen testID='screen'>
                <Text>Body content</Text>
            </PWScreen>,
        )
        expect(screen.getByText('Body content')).toBeTruthy()
    })

    it('renders the header, body and footer zones together', () => {
        render(
            <PWScreen
                testID='screen'
                header={<Text>Header</Text>}
                footer={<Text>Continue</Text>}
            >
                <Text>Body</Text>
            </PWScreen>,
        )
        expect(screen.getByText('Header')).toBeTruthy()
        expect(screen.getByText('Body')).toBeTruthy()
        expect(screen.getByText('Continue')).toBeTruthy()
    })

    it("renders a fixed body when scroll='never'", () => {
        render(
            <PWScreen
                testID='screen'
                scroll='never'
            >
                <View testID='child-list' />
            </PWScreen>,
        )
        expect(screen.getByTestId('child-list')).toBeTruthy()
    })

    it('marks descendants as nested so an inner PWScreen skips its bottom inset', () => {
        const InsetProbe = () => {
            const { bottomInset, isBottomHandledOutside } = usePWScreenInsets()
            return (
                <Text>{`${isBottomHandledOutside ? 'nested' : 'root'}:${bottomInset}`}</Text>
            )
        }

        render(
            <PWScreen testID='outer'>
                <InsetProbe />
            </PWScreen>,
        )

        expect(screen.getByText('nested:0')).toBeTruthy()
    })

    it('renders inside a tab navigator without crashing', () => {
        render(
            <BottomTabBarHeightContext.Provider value={49}>
                <PWScreen testID='screen'>
                    <Text>Tab Body</Text>
                </PWScreen>
            </BottomTabBarHeightContext.Provider>,
        )
        expect(screen.getByText('Tab Body')).toBeTruthy()
    })

    it('renders scrollable body + footer inside a bottom sheet (sheet-aware scroll path)', () => {
        // Inside a sheet PWScreen must swap its scroll container for gorhom's so
        // the body scrolls instead of being clipped by the pinned footer.
        render(
            <PWInBottomSheetContext.Provider value={true}>
                <PWScreen
                    testID='screen'
                    footer={<Text>Slide to confirm</Text>}
                >
                    <Text>Sheet body</Text>
                </PWScreen>
            </PWInBottomSheetContext.Provider>,
        )
        expect(screen.getByText('Sheet body')).toBeTruthy()
        expect(screen.getByText('Slide to confirm')).toBeTruthy()
    })

    it('exposes the testID on the root container', () => {
        render(
            <PWScreen testID='custom-screen'>
                <Text>Body</Text>
            </PWScreen>,
        )
        expect(screen.getByTestId('custom-screen')).toBeTruthy()
    })

    it('renders without a footer when none is provided', () => {
        render(
            <PWScreen testID='screen'>
                <Text>Body only</Text>
            </PWScreen>,
        )
        expect(screen.getByText('Body only')).toBeTruthy()
        expect(screen.queryByText('Continue')).toBeNull()
    })

    it('accepts horizontalPadding="none" without crashing', () => {
        render(
            <PWScreen
                testID='screen'
                horizontalPadding='none'
            >
                <Text>Edge-to-edge body</Text>
            </PWScreen>,
        )
        expect(screen.getByText('Edge-to-edge body')).toBeTruthy()
    })
})

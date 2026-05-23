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

import React from 'react'
import { Text, View } from 'react-native'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@test-utils/render'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { BottomTabBarHeightContext } from '@react-navigation/bottom-tabs'

import { PWScreen } from '../PWScreen'

describe('PWScreen', () => {
    beforeEach(() => {
        vi.mocked(useSafeAreaInsets).mockReturnValue({
            top: 47,
            bottom: 34,
            left: 0,
            right: 0,
        })
    })

    it('renders children inside a scroll body by default', () => {
        render(
            <PWScreen testID='screen'>
                <Text>Body content</Text>
            </PWScreen>,
        )
        expect(screen.getByText('Body content')).toBeTruthy()
    })

    it('renders the footer outside the scroll body', () => {
        render(
            <PWScreen
                testID='screen'
                footer={<Text>Continue</Text>}
            >
                <Text>Body</Text>
            </PWScreen>,
        )
        expect(screen.getByText('Continue')).toBeTruthy()
        expect(screen.getByText('Body')).toBeTruthy()
    })

    it('renders a fixed body when scroll=false', () => {
        render(
            <PWScreen
                testID='screen'
                scroll={false}
            >
                <View testID='child-list' />
            </PWScreen>,
        )
        expect(screen.getByTestId('child-list')).toBeTruthy()
    })

    it('renders without keyboard awareness when keyboard="none"', () => {
        render(
            <PWScreen
                testID='screen'
                keyboard='none'
                footer={<Text>Continue</Text>}
            >
                <Text>Body</Text>
            </PWScreen>,
        )
        expect(screen.getByText('Body')).toBeTruthy()
        expect(screen.getByText('Continue')).toBeTruthy()
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

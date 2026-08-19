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
import { PanelButton } from '../PanelButton'

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

    it('renders the description when provided', () => {
        render(
            <PanelButton
                title='Title'
                description='Description text'
                titleWeight='h4'
                onPress={() => {}}
            />,
        )

        expect(screen.getByText('Description text')).toBeTruthy()
    })

    it('does not render description when not provided', () => {
        render(
            <PanelButton
                title='Title Only'
                titleWeight='h4'
                onPress={() => {}}
            />,
        )

        expect(screen.getByText('Title Only')).toBeTruthy()
        expect(screen.queryByText('Description text')).toBeNull()
    })

    it('renders with a left icon via testID', () => {
        render(
            <PanelButton
                testID='panel_btn'
                title='With Icon'
                titleWeight='h4'
                leftIcon='wallet'
                onPress={() => {}}
            />,
        )

        expect(screen.getByText('With Icon')).toBeTruthy()
        expect(screen.getByTestId('panel_btn_view')).toBeTruthy()
    })

    it('renders the badge label when a badge is provided', () => {
        render(
            <PanelButton
                title='Quantum'
                titleWeight='h3'
                badge={{ label: 'NEW' }}
                onPress={() => {}}
            />,
        )

        expect(screen.getByText('NEW')).toBeTruthy()
    })

    it('does not render a badge when none is provided', () => {
        render(
            <PanelButton
                title='No Badge'
                titleWeight='h3'
                onPress={() => {}}
            />,
        )

        expect(screen.queryByText('NEW')).toBeNull()
    })

    it('renders the learn-more link and fires its own onPress without triggering the row onPress', () => {
        const onPress = vi.fn()
        const onLearnMore = vi.fn()
        render(
            <PanelButton
                title='Quantum'
                titleWeight='h3'
                learnMore={{ label: 'Learn more', onPress: onLearnMore }}
                onPress={onPress}
            />,
        )

        fireEvent.click(screen.getByText('Learn more'))
        expect(onLearnMore).toHaveBeenCalledTimes(1)
        expect(onPress).not.toHaveBeenCalled()
    })

    it('renders the badge alongside the learn-more link', () => {
        const onPress = vi.fn()
        const onLearnMore = vi.fn()
        render(
            <PanelButton
                title='Quantum'
                titleWeight='h3'
                badge={{ label: 'NEW' }}
                learnMore={{ label: 'Learn more', onPress: onLearnMore }}
                onPress={onPress}
            />,
        )

        expect(screen.getByText('NEW')).toBeTruthy()
        fireEvent.click(screen.getByText('Learn more'))
        expect(onLearnMore).toHaveBeenCalledTimes(1)
        expect(onPress).not.toHaveBeenCalled()
    })
})

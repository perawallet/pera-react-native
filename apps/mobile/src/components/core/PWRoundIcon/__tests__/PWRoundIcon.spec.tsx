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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { render, screen } from '@test-utils/render'
import { PWIcon } from '@components/core/PWIcon'
import { PWView } from '@components/core/PWView'
import { PWRoundIcon } from '../PWRoundIcon'

vi.mock('@components/core/PWIcon', () => ({
    PWIcon: vi.fn(() => null),
    getIconPixelSize: vi.fn(() => 24),
}))

vi.mock('@components/core/PWView', () => ({
    PWView: vi.fn(({ children, testID }) => (
        <div data-testid={testID}>{children}</div>
    )),
}))

describe('PWRoundIcon', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders the glyph at the default size (lg -> md icon, secondary -> primary tint)', () => {
        render(
            <PWRoundIcon
                icon='globe'
                testID='round-icon'
            />,
        )

        expect(screen.getByTestId('round-icon')).toBeTruthy()
        expect(PWIcon).toHaveBeenCalledWith(
            expect.objectContaining({
                name: 'globe',
                size: 'md',
                variant: 'primary',
            }),
            undefined,
        )
    })

    it('maps size md to a 24px (md) glyph', () => {
        render(
            <PWRoundIcon
                icon='check'
                size='md'
                variant='primary'
                testID='round-icon-md'
            />,
        )

        expect(PWIcon).toHaveBeenCalledWith(
            expect.objectContaining({
                name: 'check',
                size: 'md',
                variant: 'white',
            }),
            undefined,
        )
    })

    it('respects an explicit iconSize override', () => {
        render(
            <PWRoundIcon
                icon='check'
                size='lg'
                iconSize='xl'
                testID='round-icon-override'
            />,
        )

        expect(PWIcon).toHaveBeenCalledWith(
            expect.objectContaining({ name: 'check', size: 'xl' }),
            undefined,
        )
    })

    it('renders a self-colored account glyph without forcing a tint', () => {
        render(
            <PWRoundIcon
                icon='accounts/glyph/algo25-account'
                variant='accountTurquoise'
                size='md'
                testID='round-icon-account'
            />,
        )

        expect(PWIcon).toHaveBeenCalledWith(
            expect.objectContaining({
                name: 'accounts/glyph/algo25-account',
                size: 'md',
                variant: 'primary',
            }),
            undefined,
        )
    })

    it('passes extra props to the container', () => {
        render(
            <PWRoundIcon
                icon='globe'
                testID='round-icon-simple'
            />,
        )

        expect(PWView).toHaveBeenCalledWith(
            expect.objectContaining({ testID: 'round-icon-simple' }),
            undefined,
        )
    })
})

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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { render, screen } from '@test-utils/render'
import { PWIcon } from '@components/core/PWIcon'
import { PWView } from '@components/core/PWView'
import { PWRoundIcon } from '../PWRoundIcon'

// Mock PWIcon
vi.mock('@components/core/PWIcon', () => ({
    PWIcon: vi.fn(() => null),
}))

// Mock PWView to ensure testID is passed to the DOM and avoid checking styles
vi.mock('@components/core/PWView', () => ({
    PWView: vi.fn(({ children, testID }) => (
        <div data-testid={testID}>{children}</div>
    )),
}))

describe('PWRoundIcon', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders PWIcon with default props (secondary/md)', () => {
        render(
            <PWRoundIcon
                icon='globe'
                testID='round-icon'
            />,
        )

        // Verify container rendering (via mocked PWView)
        expect(screen.getByTestId('round-icon')).toBeTruthy()

        // Verify props passed to PWIcon
        // PWRoundIcon maps 'md' -> 'sm'
        expect(PWIcon).toHaveBeenCalledWith(
            expect.objectContaining({
                name: 'globe',
                size: 'sm',
                variant: 'secondary',
            }),
            undefined, // context is typically undefined for FC
        )
    })

    it('forwards custom size and variant to PWIcon', () => {
        render(
            <PWRoundIcon
                icon='check'
                size='md'
                variant='primary'
                testID='round-icon-custom'
            />,
        )

        expect(screen.getByTestId('round-icon-custom')).toBeTruthy()

        // PWRoundIcon maps 'md' -> 'sm'
        expect(PWIcon).toHaveBeenCalledWith(
            expect.objectContaining({
                name: 'check',
                size: 'sm',
                variant: 'primary',
            }),
            undefined,
        )
    })

    it('passes extra props to container', () => {
        render(
            <PWRoundIcon
                icon='globe'
                testID='round-icon-simple'
            />,
        )

        expect(screen.getByTestId('round-icon-simple')).toBeTruthy()
        // PWView validation
        expect(PWView).toHaveBeenCalledWith(
            expect.objectContaining({
                testID: 'round-icon-simple',
            }),
            undefined,
        )
    })
})

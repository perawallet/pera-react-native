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
import { render, screen } from '@test-utils/render'
import { PWSlideToConfirm } from '../PWSlideToConfirm'

vi.mock('lottie-react-native', () => ({
    default: ({ testID }: { testID?: string }) => <div data-testid={testID} />,
}))

vi.mock('@assets/animations/pera-transaction-loading.json', () => ({
    default: {},
}))

describe('PWSlideToConfirm', () => {
    it('renders the title when idle', () => {
        render(
            <PWSlideToConfirm
                title='Slide To Confirm'
                onConfirm={vi.fn()}
            />,
        )

        expect(screen.getAllByText('Slide To Confirm').length).toBeGreaterThan(
            0,
        )
    })

    it('mounts the Pera lottie animation when loading', () => {
        render(
            <PWSlideToConfirm
                title='Slide To Confirm'
                onConfirm={vi.fn()}
                isLoading
            />,
        )

        expect(screen.getByTestId('pw-slide-to-confirm-lottie')).toBeTruthy()
    })

    it('mounts the check icon when confirmed', () => {
        render(
            <PWSlideToConfirm
                title='Slide To Confirm'
                onConfirm={vi.fn()}
                isConfirmed
            />,
        )

        expect(screen.getByTestId('pw-slide-to-confirm-check')).toBeTruthy()
    })

    it('keeps the check icon mounted when both loading and confirmed are set', () => {
        render(
            <PWSlideToConfirm
                title='Slide To Confirm'
                onConfirm={vi.fn()}
                isLoading
                isConfirmed
            />,
        )

        expect(screen.getByTestId('pw-slide-to-confirm-check')).toBeTruthy()
    })

    it('attaches the provided testID to the root', () => {
        render(
            <PWSlideToConfirm
                title='Slide To Confirm'
                onConfirm={vi.fn()}
                testID='my-slide'
            />,
        )

        expect(screen.getByTestId('my-slide')).toBeTruthy()
    })
})

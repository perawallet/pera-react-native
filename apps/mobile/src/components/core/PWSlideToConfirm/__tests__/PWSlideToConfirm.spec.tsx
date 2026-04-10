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
import { PWSlideToConfirm } from '../PWSlideToConfirm'

vi.mock('lottie-react-native', () => ({
    default: ({ testID }: { testID?: string }) => <div data-testid={testID} />,
}))

vi.mock('@assets/animations/pera-transaction-loading.json', () => ({
    default: {},
}))

describe('PWSlideToConfirm', () => {
    it('renders the title and chevron thumb when idle', () => {
        render(
            <PWSlideToConfirm
                title='Slide To Confirm'
                onConfirm={vi.fn()}
            />,
        )

        expect(screen.getByText('Slide To Confirm')).toBeTruthy()
        expect(screen.queryByTestId('pw-slide-to-confirm-lottie')).toBeNull()
        expect(screen.queryByTestId('pw-slide-to-confirm-check')).toBeNull()
    })

    it('renders the Pera lottie animation when loading and hides the title', () => {
        render(
            <PWSlideToConfirm
                title='Slide To Confirm'
                onConfirm={vi.fn()}
                isLoading
            />,
        )

        expect(screen.getByTestId('pw-slide-to-confirm-lottie')).toBeTruthy()
        expect(screen.queryByText('Slide To Confirm')).toBeNull()
        expect(screen.queryByTestId('pw-slide-to-confirm-check')).toBeNull()
    })

    it('renders the check icon when confirmed and hides the title', () => {
        render(
            <PWSlideToConfirm
                title='Slide To Confirm'
                onConfirm={vi.fn()}
                isConfirmed
            />,
        )

        expect(screen.getByTestId('pw-slide-to-confirm-check')).toBeTruthy()
        expect(screen.queryByText('Slide To Confirm')).toBeNull()
        expect(screen.queryByTestId('pw-slide-to-confirm-lottie')).toBeNull()
    })

    it('prefers the confirmed state over the loading state', () => {
        render(
            <PWSlideToConfirm
                title='Slide To Confirm'
                onConfirm={vi.fn()}
                isLoading
                isConfirmed
            />,
        )

        expect(screen.getByTestId('pw-slide-to-confirm-check')).toBeTruthy()
        expect(screen.queryByTestId('pw-slide-to-confirm-lottie')).toBeNull()
    })

    it('attaches the provided testID to the track', () => {
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

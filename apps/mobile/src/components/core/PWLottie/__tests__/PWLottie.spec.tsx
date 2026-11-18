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

import { beforeEach, describe, expect, it, vi } from 'vitest'
import React, { forwardRef, useImperativeHandle } from 'react'
import { render, screen } from '@test-utils/render'
import { PWLottie } from '../PWLottie'

const { mockPause, mockResume, mockPlay, visibility } = vi.hoisted(() => ({
    mockPause: vi.fn(),
    mockResume: vi.fn(),
    mockPlay: vi.fn(),
    visibility: { isVisible: true },
}))

vi.mock('@hooks/useIsAnimationVisible', () => ({
    useIsAnimationVisible: () => visibility.isVisible,
}))

vi.mock('lottie-react-native', () => ({
    default: forwardRef(
        (
            {
                testID,
                style,
                webStyle,
                autoPlay,
            }: {
                testID?: string
                style?: unknown
                webStyle?: unknown
                autoPlay?: boolean
            },
            ref,
        ) => {
            useImperativeHandle(ref, () => ({
                pause: mockPause,
                resume: mockResume,
                play: mockPlay,
            }))
            return (
                <div
                    data-testid={testID ?? 'lottie-view'}
                    data-style={JSON.stringify(style)}
                    data-web-style={JSON.stringify(webStyle)}
                    data-auto-play={String(autoPlay)}
                />
            )
        },
    ),
}))

const mockSource = {
    v: '5.0',
    fr: 30,
    ip: 0,
    op: 60,
    w: 200,
    h: 200,
    nm: 'test',
    ddd: 0,
    assets: [],
    layers: [],
}

const mockStyle = { width: 160, height: 46 }

describe('PWLottie', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        visibility.isVisible = true
    })

    it('renders and forwards props to LottieView', () => {
        render(
            <PWLottie
                source={mockSource}
                testID='lottie'
            />,
        )
        expect(screen.getByTestId('lottie')).toBeTruthy()
    })

    it('derives webStyle from style so lottie-react-native sizes correctly on web', () => {
        render(
            <PWLottie
                source={mockSource}
                testID='lottie'
                style={mockStyle}
            />,
        )
        const element = screen.getByTestId('lottie')
        expect(element.dataset.style).toBe(JSON.stringify(mockStyle))
        expect(element.dataset.webStyle).toBe(JSON.stringify(mockStyle))
    })

    it('does not set webStyle when no style is passed', () => {
        render(
            <PWLottie
                source={mockSource}
                testID='lottie'
            />,
        )
        expect(screen.getByTestId('lottie').dataset.webStyle).toBe(undefined)
    })

    it('pauses an autoplaying loop when it stops being visible and resumes it when it returns', () => {
        const { rerender } = render(
            <PWLottie
                source={mockSource}
                autoPlay
                loop
            />,
        )
        expect(mockPause).not.toHaveBeenCalled()

        visibility.isVisible = false
        rerender(
            <PWLottie
                source={mockSource}
                autoPlay
                loop
            />,
        )
        expect(mockPause).toHaveBeenCalledTimes(1)

        visibility.isVisible = true
        rerender(
            <PWLottie
                source={mockSource}
                autoPlay
                loop
            />,
        )
        expect(mockResume).toHaveBeenCalledTimes(1)
    })

    it('does not autoplay a loop mounted while hidden, and plays it once visible', () => {
        visibility.isVisible = false
        const { rerender } = render(
            <PWLottie
                source={mockSource}
                autoPlay
                loop
                testID='lottie'
            />,
        )
        expect(screen.getByTestId('lottie').dataset.autoPlay).toBe('false')
        expect(mockPlay).not.toHaveBeenCalled()

        visibility.isVisible = true
        rerender(
            <PWLottie
                source={mockSource}
                autoPlay
                loop
                testID='lottie'
            />,
        )
        expect(mockPlay).toHaveBeenCalledTimes(1)
        expect(mockResume).not.toHaveBeenCalled()
    })

    it('leaves a one-shot animation alone when it stops being visible', () => {
        const { rerender } = render(
            <PWLottie
                source={mockSource}
                autoPlay
            />,
        )

        visibility.isVisible = false
        rerender(
            <PWLottie
                source={mockSource}
                autoPlay
            />,
        )
        visibility.isVisible = true
        rerender(
            <PWLottie
                source={mockSource}
                autoPlay
            />,
        )

        expect(mockPause).not.toHaveBeenCalled()
        expect(mockResume).not.toHaveBeenCalled()
    })

    it('pauses again when a hidden loop gets a new source, which restarts it natively', () => {
        const { rerender } = render(
            <PWLottie
                source={mockSource}
                autoPlay
                loop
            />,
        )
        visibility.isVisible = false
        rerender(
            <PWLottie
                source={mockSource}
                autoPlay
                loop
            />,
        )
        mockPause.mockClear()

        rerender(
            <PWLottie
                source={{ ...mockSource, nm: 'retinted' }}
                autoPlay
                loop
            />,
        )

        expect(mockPause).toHaveBeenCalledTimes(1)
        expect(mockResume).not.toHaveBeenCalled()
    })
})

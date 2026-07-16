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

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import React from 'react'
import ErrorBoundary from 'react-native-error-boundary'
import { act, render, screen } from '@test-utils/render'
import { PWText } from '@components/core'
import { OverlayErrorFallback } from '../OverlayErrorFallback'

let shouldThrow = true
const Bomb = () => {
    if (shouldThrow) throw new Error('overlay exploded')
    return <PWText>recovered</PWText>
}

describe('OverlayErrorFallback', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        // React logs caught render errors via console.error; keep output clean.
        vi.spyOn(console, 'error').mockImplementation(() => {})
        shouldThrow = true
    })

    afterEach(() => {
        vi.useRealTimers()
        vi.restoreAllMocks()
    })

    it('self-heals: resets the boundary after the delay so children remount', () => {
        const onError = vi.fn()
        render(
            <ErrorBoundary
                onError={onError}
                FallbackComponent={OverlayErrorFallback}
            >
                <Bomb />
            </ErrorBoundary>,
        )

        // Crash was caught and the fallback renders nothing.
        expect(onError).toHaveBeenCalledTimes(1)
        expect(screen.queryByText('recovered')).toBeNull()

        // The crashing state clears; after the reset delay the boundary
        // remounts its children instead of staying dead until app restart.
        shouldThrow = false
        act(() => {
            vi.advanceTimersByTime(3000)
        })

        expect(screen.getByText('recovered')).toBeTruthy()
    })

    it('keeps catching (with damping) while the crashing state persists', () => {
        const onError = vi.fn()
        render(
            <ErrorBoundary
                onError={onError}
                FallbackComponent={OverlayErrorFallback}
            >
                <Bomb />
            </ErrorBoundary>,
        )

        act(() => {
            vi.advanceTimersByTime(3000)
        })

        // Reset re-rendered the still-throwing child: caught again, not looping
        // faster than the delay allows.
        expect(onError).toHaveBeenCalledTimes(2)
        expect(screen.queryByText('recovered')).toBeNull()
    })

    it('clears the pending reset on unmount', () => {
        const resetError = vi.fn()
        const { unmount } = render(
            <OverlayErrorFallback resetError={resetError} />,
        )

        unmount()
        act(() => {
            vi.advanceTimersByTime(10_000)
        })

        expect(resetError).not.toHaveBeenCalled()
    })
})

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

import { render } from '@test-utils/render'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { PWPinCircles } from '../PWPinCircles'

describe('PWPinCircles', () => {
    beforeEach(() => {
        vi.useFakeTimers()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('renders one circle per slot', () => {
        const { container } = render(
            <PWPinCircles
                length={6}
                filledCount={0}
            />,
        )

        expect(container.firstChild?.childNodes.length).toBe(6)
    })

    it('updates the circle count when length changes', () => {
        const { container, rerender } = render(
            <PWPinCircles
                length={4}
                filledCount={0}
            />,
        )
        expect(container.firstChild?.childNodes.length).toBe(4)

        rerender(
            <PWPinCircles
                length={8}
                filledCount={0}
            />,
        )
        expect(container.firstChild?.childNodes.length).toBe(8)
    })

    it('calls onShakeComplete after the shake animation completes', () => {
        const onShakeComplete = vi.fn()
        render(
            <PWPinCircles
                length={6}
                filledCount={6}
                hasError={true}
                onShakeComplete={onShakeComplete}
            />,
        )

        expect(onShakeComplete).not.toHaveBeenCalled()
        vi.advanceTimersByTime(250)
        expect(onShakeComplete).toHaveBeenCalledTimes(1)
    })

    it('does not call onShakeComplete when hasError is false', () => {
        const onShakeComplete = vi.fn()
        render(
            <PWPinCircles
                length={6}
                filledCount={6}
                hasError={false}
                onShakeComplete={onShakeComplete}
            />,
        )

        vi.advanceTimersByTime(300)
        expect(onShakeComplete).not.toHaveBeenCalled()
    })

    it('re-fires the shake each time hasError transitions to true', () => {
        const onShakeComplete = vi.fn()
        const { rerender } = render(
            <PWPinCircles
                length={6}
                filledCount={6}
                hasError={false}
                onShakeComplete={onShakeComplete}
            />,
        )

        rerender(
            <PWPinCircles
                length={6}
                filledCount={6}
                hasError={true}
                onShakeComplete={onShakeComplete}
            />,
        )
        vi.advanceTimersByTime(250)
        expect(onShakeComplete).toHaveBeenCalledTimes(1)

        rerender(
            <PWPinCircles
                length={6}
                filledCount={6}
                hasError={false}
                onShakeComplete={onShakeComplete}
            />,
        )
        rerender(
            <PWPinCircles
                length={6}
                filledCount={6}
                hasError={true}
                onShakeComplete={onShakeComplete}
            />,
        )
        vi.advanceTimersByTime(250)
        expect(onShakeComplete).toHaveBeenCalledTimes(2)
    })

    it('does not throw when onShakeComplete is undefined', () => {
        expect(() => {
            render(
                <PWPinCircles
                    length={6}
                    filledCount={6}
                    hasError={true}
                />,
            )
            vi.advanceTimersByTime(250)
        }).not.toThrow()
    })
})

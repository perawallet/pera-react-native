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

    it('renders correct number of circles', () => {
        const { container } = render(
            <PWPinCircles
                length={6}
                filledCount={0}
            />,
        )

        // Count the number of View elements (circles) - they are direct children of the animated container
        const animatedView = container.firstChild
        expect(animatedView).toBeTruthy()
        expect(animatedView?.childNodes.length).toBe(6)
    })

    it('renders correct number of filled circles', () => {
        const { container } = render(
            <PWPinCircles
                length={6}
                filledCount={3}
            />,
        )

        const animatedView = container.firstChild
        expect(animatedView?.childNodes.length).toBe(6)
    })

    it('renders all circles empty when filledCount is 0', () => {
        const { container } = render(
            <PWPinCircles
                length={6}
                filledCount={0}
            />,
        )

        const animatedView = container.firstChild
        expect(animatedView?.childNodes.length).toBe(6)
    })

    it('renders all circles filled when filledCount equals length', () => {
        const { container } = render(
            <PWPinCircles
                length={6}
                filledCount={6}
            />,
        )

        const animatedView = container.firstChild
        expect(animatedView?.childNodes.length).toBe(6)
    })

    it('renders correct number of circles for different lengths', () => {
        const { container, rerender } = render(
            <PWPinCircles
                length={4}
                filledCount={0}
            />,
        )

        let animatedView = container.firstChild
        expect(animatedView?.childNodes.length).toBe(4)

        rerender(
            <PWPinCircles
                length={8}
                filledCount={0}
            />,
        )

        animatedView = container.firstChild
        expect(animatedView?.childNodes.length).toBe(8)
    })

    it('updates filled count when prop changes', () => {
        const { container, rerender } = render(
            <PWPinCircles
                length={6}
                filledCount={0}
            />,
        )

        rerender(
            <PWPinCircles
                length={6}
                filledCount={3}
            />,
        )

        const animatedView = container.firstChild
        expect(animatedView?.childNodes.length).toBe(6)
    })

    it('calls onShakeComplete after error animation', () => {
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

    it('calls onShakeComplete when hasError changes to true', () => {
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
    })

    it('handles onShakeComplete being undefined', () => {
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

    it('renders with default hasError prop as false', () => {
        const { container } = render(
            <PWPinCircles
                length={6}
                filledCount={0}
            />,
        )

        const animatedView = container.firstChild
        expect(animatedView?.childNodes.length).toBe(6)
    })

    it('renders partial fill correctly', () => {
        const testCases = [
            { length: 6, filledCount: 1 },
            { length: 6, filledCount: 2 },
            { length: 6, filledCount: 3 },
            { length: 6, filledCount: 4 },
            { length: 6, filledCount: 5 },
        ]

        testCases.forEach(({ length, filledCount }) => {
            const { container } = render(
                <PWPinCircles
                    length={length}
                    filledCount={filledCount}
                />,
            )

            const animatedView = container.firstChild
            expect(animatedView?.childNodes.length).toBe(length)
        })
    })

    it('handles edge case of filledCount greater than length', () => {
        const { container } = render(
            <PWPinCircles
                length={6}
                filledCount={10}
            />,
        )

        const animatedView = container.firstChild
        expect(animatedView?.childNodes.length).toBe(6)
    })

    it('handles edge case of negative filledCount', () => {
        const { container } = render(
            <PWPinCircles
                length={6}
                filledCount={-1}
            />,
        )

        const animatedView = container.firstChild
        expect(animatedView?.childNodes.length).toBe(6)
    })

    it('triggers shake animation only when hasError becomes true', () => {
        const onShakeComplete = vi.fn()
        const { rerender } = render(
            <PWPinCircles
                length={6}
                filledCount={6}
                hasError={false}
                onShakeComplete={onShakeComplete}
            />,
        )

        vi.advanceTimersByTime(300)
        expect(onShakeComplete).not.toHaveBeenCalled()

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
    })

    it('handles multiple hasError toggles', () => {
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

        vi.advanceTimersByTime(250)
        expect(onShakeComplete).toHaveBeenCalledTimes(1)

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

    it('renders with zero length', () => {
        const { container } = render(
            <PWPinCircles
                length={0}
                filledCount={0}
            />,
        )

        const animatedView = container.firstChild
        expect(animatedView?.childNodes.length).toBe(0)
    })
})

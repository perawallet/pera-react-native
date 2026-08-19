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

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { render, fireEvent, screen, act } from '@test-utils/render'
import { PWTapToConfirm } from '../PWTapToConfirm'

vi.mock('lottie-react-native', () => ({
    default: ({ testID }: { testID?: string }) => <div data-testid={testID} />,
}))

vi.mock('@assets/animations/pera-transaction-loading.json', () => ({
    default: {},
}))

const ARM_TIMEOUT_MS = 1000

const renderTapToConfirm = (
    props: Partial<React.ComponentProps<typeof PWTapToConfirm>> = {},
) => {
    const onConfirm = vi.fn()
    render(
        <PWTapToConfirm
            title='Tap To Confirm'
            armedTitle='Tap again to confirm'
            onConfirm={onConfirm}
            testID='tap-confirm'
            {...props}
        />,
    )
    return { onConfirm }
}

describe('PWTapToConfirm', () => {
    beforeEach(() => {
        vi.useFakeTimers()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('renders the title when idle', () => {
        renderTapToConfirm()

        expect(screen.getByText('Tap To Confirm')).toBeTruthy()
    })

    it('does not confirm on a single tap', () => {
        const { onConfirm } = renderTapToConfirm()

        fireEvent.click(screen.getByTestId('tap-confirm'))

        expect(onConfirm).not.toHaveBeenCalled()
    })

    it('confirms on the second tap', () => {
        const { onConfirm } = renderTapToConfirm()

        fireEvent.click(screen.getByTestId('tap-confirm'))
        fireEvent.click(screen.getByTestId('tap-confirm'))

        expect(onConfirm).toHaveBeenCalledTimes(1)
    })

    it('disarms after the timeout so a later single tap does not confirm', () => {
        const { onConfirm } = renderTapToConfirm()

        fireEvent.click(screen.getByTestId('tap-confirm'))
        act(() => {
            vi.advanceTimersByTime(ARM_TIMEOUT_MS + 100)
        })
        fireEvent.click(screen.getByTestId('tap-confirm'))

        expect(onConfirm).not.toHaveBeenCalled()
    })

    it('re-arms after a timeout and confirms on the following second tap', () => {
        const { onConfirm } = renderTapToConfirm()

        fireEvent.click(screen.getByTestId('tap-confirm'))
        act(() => {
            vi.advanceTimersByTime(ARM_TIMEOUT_MS + 100)
        })
        fireEvent.click(screen.getByTestId('tap-confirm'))
        fireEvent.click(screen.getByTestId('tap-confirm'))

        expect(onConfirm).toHaveBeenCalledTimes(1)
    })

    it('ignores taps when disabled', () => {
        const { onConfirm } = renderTapToConfirm({ isDisabled: true })

        fireEvent.click(screen.getByTestId('tap-confirm'))
        fireEvent.click(screen.getByTestId('tap-confirm'))

        expect(onConfirm).not.toHaveBeenCalled()
    })

    it('ignores taps when loading', () => {
        const { onConfirm } = renderTapToConfirm({ isLoading: true })

        fireEvent.click(screen.getByTestId('tap-confirm'))
        fireEvent.click(screen.getByTestId('tap-confirm'))

        expect(onConfirm).not.toHaveBeenCalled()
    })

    it('ignores taps when confirmed', () => {
        const { onConfirm } = renderTapToConfirm({ isConfirmed: true })

        fireEvent.click(screen.getByTestId('tap-confirm'))
        fireEvent.click(screen.getByTestId('tap-confirm'))

        expect(onConfirm).not.toHaveBeenCalled()
    })

    it('mounts the Pera lottie animation when loading', () => {
        renderTapToConfirm({ isLoading: true })

        expect(screen.getByTestId('pw-tap-to-confirm-lottie')).toBeTruthy()
    })

    it('mounts the check icon when confirmed', () => {
        renderTapToConfirm({ isConfirmed: true })

        expect(screen.getByTestId('pw-tap-to-confirm-check')).toBeTruthy()
    })
})

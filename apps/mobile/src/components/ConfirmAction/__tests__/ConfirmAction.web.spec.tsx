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
import {
    useSettings,
    type ConfirmationMode,
} from '@perawallet/wallet-core-settings'
import { TAP_TO_CONFIRM_WEB_MIN_CONFIRM_DELAY } from '@constants/ui'
import { APPROVAL_ARMING_DELAY_MS } from '@hooks/useApprovalArming.web'
import '../../../i18n'
import { ConfirmAction } from '../ConfirmAction.web'

vi.mock('lottie-react-native', () => ({
    default: ({ testID }: { testID?: string }) => <div data-testid={testID} />,
}))

vi.mock('@assets/animations/pera-transaction-loading.json', () => ({
    default: {},
}))

const setConfirmationMode = (confirmationMode: ConfirmationMode) => {
    vi.mocked(useSettings).mockReturnValue({
        theme: 'light',
        privacyMode: false,
        language: 'system',
        confirmationMode,
        setTheme: vi.fn(),
        setPrivacyMode: vi.fn(),
        setLanguage: vi.fn(),
        setConfirmationMode: vi.fn(),
    })
}

const renderConfirmAction = () => {
    const onConfirm = vi.fn()
    render(
        <ConfirmAction
            title='Slide To Confirm'
            onConfirm={onConfirm}
            testID='confirm-action'
        />,
    )
    return { onConfirm }
}

const armWindow = () => {
    act(() => {
        window.dispatchEvent(new Event('pointermove'))
        vi.advanceTimersByTime(APPROVAL_ARMING_DELAY_MS)
    })
}

const waitMinConfirmDelay = () => {
    act(() => {
        vi.advanceTimersByTime(TAP_TO_CONFIRM_WEB_MIN_CONFIRM_DELAY)
    })
}

describe('ConfirmAction (web)', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        // The web variant must ignore the stored preference entirely.
        setConfirmationMode('slide')
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('renders the tap surface even when the stored mode is "slide"', () => {
        render(
            <ConfirmAction
                title='Slide To Confirm'
                onConfirm={vi.fn()}
                testID='confirm-action'
            />,
        )

        expect(screen.getByText('Confirm')).toBeTruthy()
        expect(screen.queryByText('Slide To Confirm')).toBeNull()
    })

    it('confirms via two spaced taps once armed, keeping the callsite testID', () => {
        const { onConfirm } = renderConfirmAction()
        armWindow()

        fireEvent.click(screen.getByTestId('confirm-action'))
        expect(onConfirm).not.toHaveBeenCalled()

        waitMinConfirmDelay()
        fireEvent.click(screen.getByTestId('confirm-action'))
        expect(onConfirm).toHaveBeenCalledTimes(1)
    })

    it('does not confirm before the window is armed', () => {
        const { onConfirm } = renderConfirmAction()

        fireEvent.click(screen.getByTestId('confirm-action'))
        waitMinConfirmDelay()
        fireEvent.click(screen.getByTestId('confirm-action'))

        expect(onConfirm).not.toHaveBeenCalled()
    })

    it('does not confirm an immediate double-click', () => {
        const { onConfirm } = renderConfirmAction()
        armWindow()

        fireEvent.click(screen.getByTestId('confirm-action'))
        fireEvent.click(screen.getByTestId('confirm-action'))

        expect(onConfirm).not.toHaveBeenCalled()
    })
})

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
import { render, fireEvent, screen } from '@test-utils/render'
import {
    useSettings,
    type ConfirmationMode,
} from '@perawallet/wallet-core-settings'
import '../../../i18n'
import { ConfirmAction } from '../ConfirmAction'

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

describe('ConfirmAction', () => {
    beforeEach(() => {
        setConfirmationMode('slide')
    })

    it('renders the slide surface with the given title by default', () => {
        render(
            <ConfirmAction
                title='Slide To Confirm'
                onConfirm={vi.fn()}
                testID='confirm-action'
            />,
        )

        expect(screen.getAllByText('Slide To Confirm').length).toBeGreaterThan(
            0,
        )
        expect(screen.queryByText('Confirm')).toBeNull()
    })

    it('renders the tap surface with tap copy when confirmationMode is "tap"', () => {
        setConfirmationMode('tap')

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

    it('confirms via double tap in tap mode, keeping the callsite testID', () => {
        setConfirmationMode('tap')
        const onConfirm = vi.fn()

        render(
            <ConfirmAction
                title='Slide To Confirm'
                onConfirm={onConfirm}
                testID='confirm-action'
            />,
        )

        fireEvent.click(screen.getByTestId('confirm-action'))
        expect(onConfirm).not.toHaveBeenCalled()

        fireEvent.click(screen.getByTestId('confirm-action'))
        expect(onConfirm).toHaveBeenCalledTimes(1)
    })
})

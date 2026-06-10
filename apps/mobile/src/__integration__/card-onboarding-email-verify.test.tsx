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

import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { useCardStore } from '@perawallet/wallet-core-card'

import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import { CardOnboardingEmailVerifyScreen } from '@modules/card/screens/CardOnboardingEmailVerifyScreen'

// The screen reads the email from the store (no nav params), so seed it.
const renderVerify = () =>
    renderWithNavigation(
        CardOnboardingEmailVerifyScreen,
        'CardOnboardingEmailVerify',
    )

describe('card onboarding — email verify', () => {
    beforeEach(() => {
        const store = useCardStore.getState()
        store.resetState()
        store.setEmail('john@example.com')
    })

    it('auto-submits a full code and surfaces a wrong-code error, cleared on edit', async () => {
        renderVerify()

        const input = screen.getByTestId('card-onboarding-verify-input')

        // A full but wrong 6-digit code auto-submits and surfaces the inline
        // error (no button tap needed).
        fireEvent.change(input, { target: { value: '654321' } })
        await waitFor(() =>
            expect(
                screen.queryByTestId('card-onboarding-verify-input-error'),
            ).toBeTruthy(),
        )

        // Editing to a shorter value clears the error (and doesn't re-submit).
        fireEvent.change(input, { target: { value: '65432' } })
        await waitFor(() =>
            expect(
                screen.queryByTestId('card-onboarding-verify-input-error'),
            ).toBeNull(),
        )
    })
})

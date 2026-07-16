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

    it('auto-submits a full code, stashing it for the password step', async () => {
        renderVerify()

        const input = screen.getByTestId('card-onboarding-verify-input')

        // This screen can't validate the code (the real email/verify runs at
        // the password step), so a full 6-digit code auto-submits and is just
        // stashed for that step.
        fireEvent.change(input, { target: { value: '654321' } })
        await waitFor(() =>
            expect(useCardStore.getState().verificationCode).toBe('654321'),
        )
    })
})

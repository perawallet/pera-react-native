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

import { describe, expect, it } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'

import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import { CardOnboardingEmailVerifyScreen } from '@modules/card/screens/CardOnboardingEmailVerifyScreen'

const renderVerify = () =>
    renderWithNavigation(
        CardOnboardingEmailVerifyScreen,
        'CardOnboardingEmailVerify',
        { initialParams: { email: 'john@example.com', countryIso: 'GB' } },
    )

describe('card onboarding — email verify', () => {
    it('surfaces a wrong-code error on submit and clears it when the code is edited', async () => {
        renderVerify()

        const input = screen.getByTestId('card-onboarding-verify-input')

        // Submitting a wrong code surfaces the error message on the input.
        fireEvent.change(input, { target: { value: 'WRONG1' } })
        fireEvent.click(screen.getByTestId('card-onboarding-verify-confirm'))
        await waitFor(() =>
            expect(input.getAttribute('errormessage')).toBeTruthy(),
        )

        // Editing the code clears the error.
        fireEvent.change(input, { target: { value: 'WRONG12' } })
        await waitFor(() =>
            expect(input.getAttribute('errormessage')).toBeFalsy(),
        )
    })
})

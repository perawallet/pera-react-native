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

import {
    afterAll,
    afterEach,
    beforeAll,
    describe,
    expect,
    it,
    vi,
} from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'

import { server } from '@test-utils/msw-server'
import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import { CardOnboardingPasswordScreen } from '@modules/card/screens/CardOnboardingPasswordScreen'

const VALID_PASSWORD = 'Passw0rd!'

const renderPassword = () =>
    renderWithNavigation(
        CardOnboardingPasswordScreen,
        'CardOnboardingPassword',
        {
            initialParams: {
                email: 'john@example.com',
                countryIso: 'GB',
                verificationCode: 'PERA123',
            },
        },
    )

describe('card onboarding — password', () => {
    beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }))
    afterEach(() => server.resetHandlers())
    afterAll(() => server.close())

    it('submits email/verify only once the password is valid and matches', async () => {
        const verifySpy = vi.fn(() =>
            HttpResponse.json({ onboardingId: 'mock' }, { status: 200 }),
        )
        server.use(http.post('*/v1/auth/register/email/verify', verifySpy))

        renderPassword()
        const password = screen.getByTestId('card-onboarding-password-input')
        const confirm = screen.getByTestId(
            'card-onboarding-confirm-password-input',
        )

        // Mismatched confirmation surfaces an error and blocks submission.
        fireEvent.change(password, { target: { value: VALID_PASSWORD } })
        fireEvent.change(confirm, { target: { value: 'different' } })
        fireEvent.click(screen.getByTestId('card-onboarding-password-confirm'))
        await waitFor(() =>
            expect(confirm.getAttribute('errormessage')).toBeTruthy(),
        )
        expect(verifySpy).not.toHaveBeenCalled()

        // Once the confirmation matches, the form validates (error clears, the
        // button enables) and submission fires the (mocked) email/verify call.
        fireEvent.change(confirm, { target: { value: VALID_PASSWORD } })
        await waitFor(() =>
            expect(confirm.getAttribute('errormessage')).toBeFalsy(),
        )
        fireEvent.click(screen.getByTestId('card-onboarding-password-confirm'))
        await waitFor(() => expect(verifySpy).toHaveBeenCalled())
    })
})

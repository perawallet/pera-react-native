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
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { useCardStore } from '@perawallet/wallet-core-card'

import { server } from '@test-utils/msw-server'
import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import { CardOnboardingPasswordScreen } from '@modules/card/screens/CardOnboardingPasswordScreen'
import { CardOnboardingEmailVerifyScreen } from '@modules/card/screens/CardOnboardingEmailVerifyScreen'

const VALID_PASSWORD = 'Passw0rd!'

// The screen reads the flow's data from the store (no nav params), so seed it.
// EmailVerify is registered so the "missing code" guard can route back to it.
const renderPassword = () =>
    renderWithNavigation(
        CardOnboardingPasswordScreen,
        'CardOnboardingPassword',
        {
            additionalScreens: [
                {
                    name: 'CardOnboardingEmailVerify',
                    component: CardOnboardingEmailVerifyScreen,
                },
            ],
        },
    )

describe('card onboarding — password', () => {
    beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }))
    beforeEach(() => {
        const store = useCardStore.getState()
        store.resetState()
        store.setEmail('john@example.com')
        store.setCountryIso('GB')
        store.setVerificationCode('PERA123')
        store.setContactVerificationId('mock-contact-id')
    })
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

    it('routes back to verify (without calling email/verify) when the code is missing', async () => {
        const verifySpy = vi.fn(() =>
            HttpResponse.json({ onboardingId: 'mock' }, { status: 200 }),
        )
        server.use(http.post('*/v1/auth/register/email/verify', verifySpy))

        // Simulate a lost transient OTP (e.g. the app was killed mid-flow): the
        // code isn't persisted, so it's gone while email/contact id survive.
        useCardStore.getState().setVerificationCode(null)

        renderPassword()
        const password = screen.getByTestId('card-onboarding-password-input')
        const confirm = screen.getByTestId(
            'card-onboarding-confirm-password-input',
        )
        fireEvent.change(password, { target: { value: VALID_PASSWORD } })
        fireEvent.change(confirm, { target: { value: VALID_PASSWORD } })
        await waitFor(() =>
            expect(confirm.getAttribute('errormessage')).toBeFalsy(),
        )
        fireEvent.click(screen.getByTestId('card-onboarding-password-confirm'))

        // The guard sends the user back to verify instead of POSTing an empty code.
        await waitFor(() =>
            expect(
                screen.getByTestId('card-onboarding-email-verify'),
            ).toBeTruthy(),
        )
        expect(verifySpy).not.toHaveBeenCalled()
    })
})

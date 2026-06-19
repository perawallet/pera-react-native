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
import { CardOnboardingEmailScreen } from '@modules/card/screens/CardOnboardingEmailScreen'
import { CardOnboardingEmailVerifyScreen } from '@modules/card/screens/CardOnboardingEmailVerifyScreen'
import { CardOnboardingPhoneVerifyScreen } from '@modules/card/screens/CardOnboardingPhoneVerifyScreen'
import { CardOnboardingVerificationScreen } from '@modules/card/screens/CardOnboardingVerificationScreen'

const VALID_PASSWORD = 'Passw0rd!'

// GET /v1/auth/settings — consumed by the email screen the missing-data guard
// restarts at, to load the country list.
const SETTINGS_RESPONSE = {
    countries: [
        {
            id: 'gb',
            iso3166alpha2: 'GB',
            name: 'United Kingdom',
            callingCode: '44',
            canSignUp: true,
        },
    ],
    usStates: [],
}

// The screen reads the flow's data from the store (no nav params), so seed it.
// Email is registered so the "missing email-step data" guard can restart there,
// EmailVerify so the "missing code" guard can route back to it, PhoneVerify for
// the deferred phone/verify failure path, and Verification so a successful
// submit can advance to the KYC entry.
const renderPassword = () =>
    renderWithNavigation(
        CardOnboardingPasswordScreen,
        'CardOnboardingPassword',
        {
            additionalScreens: [
                {
                    name: 'CardOnboardingEmail',
                    component: CardOnboardingEmailScreen,
                },
                {
                    name: 'CardOnboardingEmailVerify',
                    component: CardOnboardingEmailVerifyScreen,
                },
                {
                    name: 'CardOnboardingPhoneVerify',
                    component: CardOnboardingPhoneVerifyScreen,
                },
                {
                    name: 'CardOnboardingVerification',
                    component: CardOnboardingVerificationScreen,
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
        store.setVerificationCode('123456')
        store.setPhone({ phoneCountryCode: '44', phoneNumber: '7400846282' })
        store.setPhoneVerificationCode('123456')
        store.setContactVerificationId('mock-contact-id')
    })
    afterEach(() => server.resetHandlers())
    afterAll(() => server.close())

    it('submits email/verify then the deferred phone/verify, and advances to the KYC entry', async () => {
        const verifySpy = vi.fn(() =>
            HttpResponse.json({ onboardingId: 'mock' }, { status: 200 }),
        )
        const phoneVerifySpy = vi.fn(() =>
            HttpResponse.json({}, { status: 200 }),
        )
        server.use(
            http.post('*/v1/auth/register/email/verify', verifySpy),
            http.post('*/v1/auth/register/phone/verify', phoneVerifySpy),
        )

        renderPassword()
        const password = screen.getByTestId('card-onboarding-password-input')
        const confirm = screen.getByTestId(
            'card-onboarding-confirm-password-input',
        )

        // Mismatched confirmation surfaces an error (only after the confirm
        // field is blurred) and blocks submission.
        fireEvent.change(password, { target: { value: VALID_PASSWORD } })
        fireEvent.change(confirm, { target: { value: 'different' } })
        fireEvent.blur(confirm)
        await waitFor(() =>
            expect(confirm.getAttribute('errormessage')).toBeTruthy(),
        )
        fireEvent.click(screen.getByTestId('card-onboarding-password-confirm'))
        expect(verifySpy).not.toHaveBeenCalled()

        // Once the confirmation matches, the form validates (error clears, the
        // button enables) and submission fires the (mocked) email/verify call.
        fireEvent.change(confirm, { target: { value: VALID_PASSWORD } })
        await waitFor(() =>
            expect(confirm.getAttribute('errormessage')).toBeFalsy(),
        )
        fireEvent.click(screen.getByTestId('card-onboarding-password-confirm'))
        await waitFor(() => expect(verifySpy).toHaveBeenCalled())
        await waitFor(() => expect(phoneVerifySpy).toHaveBeenCalled())

        // Both verifications done: the flow advances to the KYC entry screen.
        await waitFor(() =>
            expect(
                screen.getByTestId('card-onboarding-verification'),
            ).toBeTruthy(),
        )
    })

    it('routes back to the phone code screen when the deferred phone/verify fails', async () => {
        server.use(
            http.post('*/v1/auth/register/email/verify', () =>
                HttpResponse.json({ onboardingId: 'mock' }, { status: 200 }),
            ),
            http.post('*/v1/auth/register/phone/verify', () =>
                HttpResponse.json({ message: 'wrong code' }, { status: 400 }),
            ),
        )

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

        // The password is set, but the stashed phone code was rejected — the
        // user fixes it on the phone code screen (which then verifies directly),
        // where the rejection is surfaced inline on the code input.
        await waitFor(() =>
            expect(
                screen.getByTestId('card-onboarding-phone-verify-input'),
            ).toBeTruthy(),
        )
        await waitFor(() =>
            expect(
                screen.getByTestId('card-onboarding-phone-verify-input-error'),
            ).toBeTruthy(),
        )
    })

    it('routes back to the email code screen, with an inline error, when email/verify rejects the code', async () => {
        const verifySpy = vi.fn(() =>
            HttpResponse.json({ message: 'invalid code' }, { status: 422 }),
        )
        server.use(http.post('*/v1/auth/register/email/verify', verifySpy))

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

        await waitFor(() => expect(verifySpy).toHaveBeenCalled())
        // A rejected (deferred) email code sends the user back to the email code
        // screen with the failure surfaced inline rather than leaving them stuck.
        await waitFor(() =>
            expect(
                screen.getByTestId('card-onboarding-email-verify'),
            ).toBeTruthy(),
        )
        await waitFor(() =>
            expect(
                screen.getByTestId('card-onboarding-verify-input-error'),
            ).toBeTruthy(),
        )
    })

    it('shows the live password requirements checklist', () => {
        renderPassword()

        expect(
            screen.getByTestId('card-onboarding-password-rule-length'),
        ).toBeTruthy()
        expect(
            screen.getByTestId('card-onboarding-password-rule-special'),
        ).toBeTruthy()
    })

    it('skips email/verify and re-runs only phone/verify when an onboarding id already exists', async () => {
        // The user returned here after the deferred phone/verify failed:
        // email/verify already ran (the onboarding id + password are set), so it
        // must not fire again with the now-spent email code.
        useCardStore.getState().setOnboardingId('existing-ob-id')
        const verifySpy = vi.fn(() =>
            HttpResponse.json({ onboardingId: 'mock' }, { status: 200 }),
        )
        const phoneVerifySpy = vi.fn(() =>
            HttpResponse.json({}, { status: 200 }),
        )
        server.use(
            http.post('*/v1/auth/register/email/verify', verifySpy),
            http.post('*/v1/auth/register/phone/verify', phoneVerifySpy),
        )

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

        // Only phone/verify runs; the flow still advances to the KYC entry.
        await waitFor(() => expect(phoneVerifySpy).toHaveBeenCalled())
        expect(verifySpy).not.toHaveBeenCalled()
        await waitFor(() =>
            expect(
                screen.getByTestId('card-onboarding-verification'),
            ).toBeTruthy(),
        )
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

    it('restarts at the email step (without calling email/verify) when the contact verification id is missing', async () => {
        const verifySpy = vi.fn(() =>
            HttpResponse.json({ onboardingId: 'mock' }, { status: 200 }),
        )
        server.use(
            http.post('*/v1/auth/register/email/verify', verifySpy),
            // The email screen the guard restarts at loads the country list.
            http.get('*/v1/auth/settings', () =>
                HttpResponse.json(SETTINGS_RESPONSE, { status: 200 }),
            ),
        )

        // The contactVerificationId is issued by the email/send call on the
        // first screen; without it we can't verify, so the guard must restart
        // the flow at the email step rather than POSTing an empty id.
        useCardStore.getState().setContactVerificationId(null)

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

        // The guard lands the user back on the email entry screen.
        await waitFor(() =>
            expect(
                screen.getByTestId('card-onboarding-email-input'),
            ).toBeTruthy(),
        )
        expect(verifySpy).not.toHaveBeenCalled()
    })
})

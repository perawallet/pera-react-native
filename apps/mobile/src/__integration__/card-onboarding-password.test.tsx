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
import { CardOnboardingPhoneScreen } from '@modules/card/screens/CardOnboardingPhoneScreen'

const VALID_PASSWORD = 'Passw0rd!Longer1'

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
// EmailVerify so the "missing code"/rejected-code paths can route back to it,
// and Phone so a successful submit can advance to the phone steps.
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
                    name: 'CardOnboardingPhone',
                    component: CardOnboardingPhoneScreen,
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
        store.setContactVerificationId('mock-contact-id')
    })
    afterEach(() => server.resetHandlers())
    afterAll(() => server.close())

    it('submits email/verify and advances to the phone step', async () => {
        let verifyBody: Record<string, unknown> | undefined
        const verifySpy = vi.fn(async ({ request }) => {
            verifyBody = (await request.json()) as Record<string, unknown>
            return HttpResponse.json({ onboardingId: 'mock' }, { status: 200 })
        })
        const phoneVerifySpy = vi.fn(() =>
            HttpResponse.json({}, { status: 200 }),
        )
        server.use(
            http.post('*/v1/auth/register/email/verify', verifySpy),
            http.post('*/v1/auth/register/phone/verify', phoneVerifySpy),
            // The phone screen the flow advances to loads the country list.
            http.get('*/v1/auth/settings', () =>
                HttpResponse.json(SETTINGS_RESPONSE, { status: 200 }),
            ),
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
        // button enables). Tick both consent opt-ins so email/verify carries them.
        fireEvent.change(confirm, { target: { value: VALID_PASSWORD } })
        await waitFor(() =>
            expect(confirm.getAttribute('errormessage')).toBeFalsy(),
        )
        fireEvent.click(
            screen.getByTestId('card-onboarding-password-marketing-checkbox'),
        )
        fireEvent.click(
            screen.getByTestId('card-onboarding-password-sms-checkbox'),
        )
        fireEvent.click(screen.getByTestId('card-onboarding-password-confirm'))
        await waitFor(() => expect(verifySpy).toHaveBeenCalled())

        // The required consent flags are sent with the real user choices.
        expect(verifyBody).toMatchObject({
            allowMarketing: true,
            allowSms: true,
        })

        // Email verified + password set: the flow advances to the phone step,
        // and phone/verify is NOT fired here (it runs on the phone screens now).
        await waitFor(() =>
            expect(
                screen.getByTestId('card-onboarding-phone-input'),
            ).toBeTruthy(),
        )
        expect(phoneVerifySpy).not.toHaveBeenCalled()
    })

    it('keeps Continue disabled (and never calls email/verify) until SMS consent is ticked', async () => {
        const verifySpy = vi.fn(() =>
            HttpResponse.json({ onboardingId: 'mock' }, { status: 200 }),
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

        // A valid password alone does NOT enable Continue — SMS is required.
        const submit = screen.getByTestId('card-onboarding-password-confirm')
        expect(submit.getAttribute('disabled')).not.toBeNull()
        fireEvent.click(submit)
        expect(verifySpy).not.toHaveBeenCalled()

        // Ticking the SMS consent enables it.
        fireEvent.click(
            screen.getByTestId('card-onboarding-password-sms-checkbox'),
        )
        await waitFor(() => expect(submit.getAttribute('disabled')).toBeNull())
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
        // SMS consent is required, so tick it to enable Continue.
        fireEvent.click(
            screen.getByTestId('card-onboarding-password-sms-checkbox'),
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

    it('skips email/verify and advances to the phone step when an onboarding id already exists', async () => {
        // The user backed into this screen after already verifying: email/verify
        // ran (the onboarding id + password are set), so it must not fire again
        // with the now-spent email code.
        useCardStore.getState().setOnboardingId('existing-ob-id')
        const verifySpy = vi.fn(() =>
            HttpResponse.json({ onboardingId: 'mock' }, { status: 200 }),
        )
        server.use(
            http.post('*/v1/auth/register/email/verify', verifySpy),
            // The phone screen the flow advances to loads the country list.
            http.get('*/v1/auth/settings', () =>
                HttpResponse.json(SETTINGS_RESPONSE, { status: 200 }),
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
        // SMS consent is required, so tick it to enable Continue.
        fireEvent.click(
            screen.getByTestId('card-onboarding-password-sms-checkbox'),
        )
        fireEvent.click(screen.getByTestId('card-onboarding-password-confirm'))

        // No email/verify call; the flow still advances to the phone step.
        await waitFor(() =>
            expect(
                screen.getByTestId('card-onboarding-phone-input'),
            ).toBeTruthy(),
        )
        expect(verifySpy).not.toHaveBeenCalled()
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
        // SMS consent is required, so tick it to enable Continue.
        fireEvent.click(
            screen.getByTestId('card-onboarding-password-sms-checkbox'),
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
        // SMS consent is required, so tick it to enable Continue.
        fireEvent.click(
            screen.getByTestId('card-onboarding-password-sms-checkbox'),
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

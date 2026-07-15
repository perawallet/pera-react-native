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
import { Notifier } from 'react-native-notifier'
import { useCardStore } from '@perawallet/wallet-core-card'

import { server } from '@test-utils/msw-server'
import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import { CardOnboardingPhoneScreen } from '@modules/card/screens/CardOnboardingPhoneScreen'
import { CardOnboardingPhoneVerifyScreen } from '@modules/card/screens/CardOnboardingPhoneVerifyScreen'

const PHONE_NUMBER = '7400846282'

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
const renderPhone = () =>
    renderWithNavigation(CardOnboardingPhoneScreen, 'CardOnboardingPhone', {
        additionalScreens: [
            {
                name: 'CardOnboardingPhoneVerify',
                component: CardOnboardingPhoneVerifyScreen,
            },
        ],
    })

describe('card onboarding — phone', () => {
    beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }))
    beforeEach(() => {
        vi.mocked(Notifier.showNotification).mockClear()
        const store = useCardStore.getState()
        store.resetState()
        store.setEmail('john@example.com')
        store.setCountryIso('GB')
        store.setContactVerificationId('mock-contact-id')
        server.use(
            http.get('*/v1/auth/settings', () =>
                HttpResponse.json(SETTINGS_RESPONSE, { status: 200 }),
            ),
        )
    })
    afterEach(() => server.resetHandlers())
    afterAll(() => server.close())

    it('preselects the residence calling code, sends the code (no leading +), and opens verify', async () => {
        let sendBody: Record<string, unknown> | undefined
        const sendSpy = vi.fn()
        server.use(
            http.post('*/v1/auth/register/phone/send', async ({ request }) => {
                sendBody = (await request.json()) as Record<string, unknown>
                sendSpy()
                return HttpResponse.json({}, { status: 200 })
            }),
        )

        renderPhone()

        fireEvent.change(screen.getByTestId('card-onboarding-phone-input'), {
            target: { value: PHONE_NUMBER },
        })
        // Preselect sets the calling code, so the form validates and enables.
        const confirm = screen.getByTestId('card-onboarding-phone-confirm')
        await waitFor(() => expect(confirm.getAttribute('disabled')).toBeNull())
        fireEvent.click(confirm)

        await waitFor(() => expect(sendSpy).toHaveBeenCalled())
        // The dialing code is sent without the leading '+'.
        expect(Object.values(sendBody ?? {})).toContain(PHONE_NUMBER)
        expect(Object.values(sendBody ?? {})).toContain('44')
        expect(Object.values(sendBody ?? {})).not.toContain('+44')

        // A successful send advances the flow to the verify screen.
        await waitFor(() =>
            expect(
                screen.getByTestId('card-onboarding-phone-verify'),
            ).toBeTruthy(),
        )
    })

    it('shows an error toast and stays on the phone screen when the send fails', async () => {
        server.use(
            http.post('*/v1/auth/register/phone/send', () =>
                HttpResponse.json({ message: 'nope' }, { status: 500 }),
            ),
        )

        renderPhone()

        fireEvent.change(screen.getByTestId('card-onboarding-phone-input'), {
            target: { value: PHONE_NUMBER },
        })
        const confirm = screen.getByTestId('card-onboarding-phone-confirm')
        await waitFor(() => expect(confirm.getAttribute('disabled')).toBeNull())
        fireEvent.click(confirm)

        await waitFor(() =>
            expect(Notifier.showNotification).toHaveBeenCalled(),
        )
        expect(screen.queryByTestId('card-onboarding-phone-verify')).toBeNull()
    })

    it('Given a conflict with a Baanx message, when the code is sent, then that message is shown on the phone field', async () => {
        server.use(
            http.post('*/v1/auth/register/phone/send', () =>
                HttpResponse.json(
                    { message: 'That number is already in use' },
                    { status: 409 },
                ),
            ),
        )

        renderPhone()
        const input = screen.getByTestId('card-onboarding-phone-input')
        fireEvent.change(input, { target: { value: PHONE_NUMBER } })
        fireEvent.blur(input)
        const confirm = screen.getByTestId('card-onboarding-phone-confirm')
        await waitFor(() => expect(confirm.getAttribute('disabled')).toBeNull())
        fireEvent.click(confirm)

        // The real Baanx message is attributed to the field, and the flow stays put.
        await waitFor(() =>
            expect(
                screen
                    .getByTestId('card-onboarding-phone-input')
                    .getAttribute('errormessage'),
            ).toBe('That number is already in use'),
        )
        expect(screen.queryByTestId('card-onboarding-phone-verify')).toBeNull()
    })

    it('Given a conflict with no message body, when the code is sent, then the localized fallback is shown', async () => {
        server.use(
            http.post('*/v1/auth/register/phone/send', () =>
                HttpResponse.json({}, { status: 409 }),
            ),
        )

        renderPhone()
        const input = screen.getByTestId('card-onboarding-phone-input')
        fireEvent.change(input, { target: { value: PHONE_NUMBER } })
        fireEvent.blur(input)
        const confirm = screen.getByTestId('card-onboarding-phone-confirm')
        await waitFor(() => expect(confirm.getAttribute('disabled')).toBeNull())
        fireEvent.click(confirm)

        await waitFor(() =>
            expect(
                screen
                    .getByTestId('card-onboarding-phone-input')
                    .getAttribute('errormessage'),
            ).toBe('peraCard.verify_phone.phone_taken'),
        )
    })

    it('shows the invalid-number error only after the field is blurred', async () => {
        renderPhone()
        const input = screen.getByTestId('card-onboarding-phone-input')

        // Too short to be valid, but no error while still typing (not blurred).
        fireEvent.change(input, { target: { value: '7' } })
        expect(input.getAttribute('errormessage')).toBeFalsy()

        fireEvent.blur(input)
        await waitFor(() =>
            expect(
                screen
                    .getByTestId('card-onboarding-phone-input')
                    .getAttribute('errormessage'),
            ).toBe('peraCard.verify_phone.phone_invalid'),
        )
    })
})

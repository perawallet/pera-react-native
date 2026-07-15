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
import { useDeviceStore } from '@perawallet/wallet-core-device'

import { server } from '@test-utils/msw-server'
import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import { CardOnboardingEmailScreen } from '@modules/card/screens/CardOnboardingEmailScreen'
import { CardOnboardingEmailVerifyScreen } from '@modules/card/screens/CardOnboardingEmailVerifyScreen'

const DEVICE_ID = 'integration-test-device'

// Raw GET /v1/auth/settings shape (already camelCase; see the card package's
// registrationSettingsResponseSchema). RU is ineligible (canSignUp: false) so
// it stays selectable and routes to the waitlist instead of Continue.
const SETTINGS_RESPONSE = {
    countries: [
        {
            id: 'gb',
            iso3166alpha2: 'GB',
            name: 'United Kingdom',
            callingCode: '44',
            canSignUp: true,
        },
        {
            id: 'fr',
            iso3166alpha2: 'FR',
            name: 'France',
            callingCode: '33',
            canSignUp: true,
        },
        {
            id: 'ru',
            iso3166alpha2: 'RU',
            name: 'Russia',
            callingCode: '7',
            canSignUp: false,
        },
    ],
    usStates: [],
}

// GET /v1/cards/supported-countries/ (Pera backend) — we only consume
// `current_region` to preselect the country. `alpha_2` (not `alpha_2_code`).
const supportedCountriesResponse = (alpha2: string, name: string) => ({
    current_region: { alpha_2: alpha2, name },
    regions: [],
})

const renderFlow = () =>
    renderWithNavigation(CardOnboardingEmailScreen, 'CardOnboardingEmail', {
        additionalScreens: [
            {
                name: 'CardOnboardingEmailVerify',
                component: CardOnboardingEmailVerifyScreen,
            },
        ],
    })

// Open the country picker and pick the country with the given ISO code.
const openPickerAndSelect = async (countryCode: string) => {
    fireEvent.click(screen.getByTestId('card-onboarding-country-field'))
    await waitFor(() =>
        expect(screen.getByTestId(`card-country-${countryCode}`)).toBeTruthy(),
    )
    fireEvent.click(screen.getByTestId(`card-country-${countryCode}`))
    // Selecting resolves + closes the sheet (and sets the form's country).
    await waitFor(() =>
        expect(screen.queryByTestId(`card-country-${countryCode}`)).toBeNull(),
    )
}

// Enter a valid email, open the country picker, and select the UK.
const enterEmailAndCountry = async () => {
    fireEvent.change(screen.getByTestId('card-onboarding-email-input'), {
        target: { value: 'john@example.com' },
    })
    await openPickerAndSelect('GB')
}

describe('Flow: Card onboarding — email + country', () => {
    beforeAll(() => {
        server.listen({ onUnhandledRequest: 'warn' })
        // The waitlist call sends the device id; the harness defaults to mainnet.
        useDeviceStore.getState().setDeviceID('mainnet', DEVICE_ID)
    })
    beforeEach(() => {
        vi.mocked(Notifier.showNotification).mockClear()
        // Default region is not in SETTINGS_RESPONSE → nothing preselected, so
        // the manual-selection flows stay deterministic. Tests can override.
        server.use(
            http.get('*/v1/cards/supported-countries/', () =>
                HttpResponse.json(supportedCountriesResponse('ZZ', 'Nowhere'), {
                    status: 200,
                }),
            ),
        )
    })
    afterEach(() => server.resetHandlers())
    afterAll(() => server.close())

    it('Given a valid email and an eligible country, when Confirm is pressed, then the code is sent and the verification screen opens', async () => {
        const sendSpy = vi.fn(() =>
            HttpResponse.json(
                { contactVerificationId: 'mock-contact-id' },
                { status: 200 },
            ),
        )
        server.use(
            http.get('*/v1/auth/settings', () =>
                HttpResponse.json(SETTINGS_RESPONSE, { status: 200 }),
            ),
            http.post('*/v1/auth/register/email/send', sendSpy),
        )

        renderFlow()
        await enterEmailAndCountry()

        fireEvent.click(screen.getByTestId('card-onboarding-email-confirm'))

        await waitFor(() => expect(sendSpy).toHaveBeenCalled())
        await waitFor(() =>
            expect(
                screen.getByTestId('card-onboarding-email-verify'),
            ).toBeTruthy(),
        )
    })

    it('Given the send-code request fails, when Confirm is pressed, then an error toast shows and the flow stays on the email screen', async () => {
        server.use(
            http.get('*/v1/auth/settings', () =>
                HttpResponse.json(SETTINGS_RESPONSE, { status: 200 }),
            ),
            http.post('*/v1/auth/register/email/send', () =>
                HttpResponse.json({ message: 'nope' }, { status: 500 }),
            ),
        )

        renderFlow()
        await enterEmailAndCountry()

        fireEvent.click(screen.getByTestId('card-onboarding-email-confirm'))

        await waitFor(() =>
            expect(Notifier.showNotification).toHaveBeenCalled(),
        )
        expect(screen.queryByTestId('card-onboarding-email-verify')).toBeNull()
    })

    it('Given a conflict with a Baanx message, when Confirm is pressed, then that message is shown on the email field', async () => {
        server.use(
            http.get('*/v1/auth/settings', () =>
                HttpResponse.json(SETTINGS_RESPONSE, { status: 200 }),
            ),
            http.post('*/v1/auth/register/email/send', () =>
                HttpResponse.json(
                    { message: 'That email is already in use' },
                    { status: 409 },
                ),
            ),
        )

        renderFlow()
        const input = screen.getByTestId('card-onboarding-email-input')
        fireEvent.change(input, { target: { value: 'john@example.com' } })
        // Blur so the (server) error is allowed to render, mirroring the user
        // tapping the country field after typing.
        fireEvent.blur(input)
        await openPickerAndSelect('GB')

        fireEvent.click(screen.getByTestId('card-onboarding-email-confirm'))

        // The real Baanx message is attributed to the field, and the flow stays
        // on the email screen.
        await waitFor(() =>
            expect(input.getAttribute('errormessage')).toBe(
                'That email is already in use',
            ),
        )
        expect(screen.queryByTestId('card-onboarding-email-verify')).toBeNull()
    })

    it('Given a conflict with no message body, when Confirm is pressed, then the localized fallback is shown', async () => {
        server.use(
            http.get('*/v1/auth/settings', () =>
                HttpResponse.json(SETTINGS_RESPONSE, { status: 200 }),
            ),
            http.post('*/v1/auth/register/email/send', () =>
                HttpResponse.json({}, { status: 409 }),
            ),
        )

        renderFlow()
        const input = screen.getByTestId('card-onboarding-email-input')
        fireEvent.change(input, { target: { value: 'john@example.com' } })
        fireEvent.blur(input)
        await openPickerAndSelect('GB')

        fireEvent.click(screen.getByTestId('card-onboarding-email-confirm'))

        await waitFor(() =>
            expect(input.getAttribute('errormessage')).toBe(
                'peraCard.create_account.email_taken',
            ),
        )
    })

    it('Given an unsupported country, when Sign up for waitlist is pressed, then the country + device are submitted and the success sheet opens', async () => {
        let waitlistBody: unknown
        const waitlistSpy = vi.fn()
        server.use(
            http.get('*/v1/auth/settings', () =>
                HttpResponse.json(SETTINGS_RESPONSE, { status: 200 }),
            ),
            http.post(
                '*/v1/cards/country-availability-request/',
                async ({ request }) => {
                    waitlistBody = await request.json()
                    waitlistSpy()
                    return HttpResponse.json({}, { status: 200 })
                },
            ),
        )

        renderFlow()
        // No email entered — the waitlist is reachable from country alone.
        await openPickerAndSelect('RU')

        // The primary CTA switches to the waitlist button; Confirm is gone.
        expect(screen.getByTestId('card-onboarding-waitlist-join')).toBeTruthy()
        expect(screen.queryByTestId('card-onboarding-email-confirm')).toBeNull()

        fireEvent.click(screen.getByTestId('card-onboarding-waitlist-join'))

        await waitFor(() => expect(waitlistSpy).toHaveBeenCalled())
        expect(waitlistBody).toEqual({
            alpha_2_country_code: 'RU',
            device: DEVICE_ID,
        })
        await waitFor(() =>
            expect(
                screen.getByTestId('card-waitlist-success-dismiss'),
            ).toBeTruthy(),
        )
    })

    it('shows the email error only after blur, not while typing', async () => {
        server.use(
            http.get('*/v1/auth/settings', () =>
                HttpResponse.json(SETTINGS_RESPONSE, { status: 200 }),
            ),
        )

        renderFlow()
        const input = screen.getByTestId('card-onboarding-email-input')

        fireEvent.change(input, { target: { value: 'not-an-email' } })
        // While typing (field not yet blurred) → no error.
        expect(input.getAttribute('errormessage')).toBeFalsy()

        fireEvent.blur(input)
        await waitFor(() =>
            expect(input.getAttribute('errormessage')).toBe(
                'peraCard.create_account.email_invalid',
            ),
        )
    })

    it('preselects the geo-detected region without the user opening the picker', async () => {
        server.use(
            http.get('*/v1/auth/settings', () =>
                HttpResponse.json(SETTINGS_RESPONSE, { status: 200 }),
            ),
            http.get('*/v1/cards/supported-countries/', () =>
                HttpResponse.json(supportedCountriesResponse('RU', 'Russia'), {
                    status: 200,
                }),
            ),
        )

        renderFlow()

        // RU is the detected region and is unsupported (canSignUp:false) in the
        // settings, so it's preselected and the waitlist CTA appears with no
        // picker interaction — proving the region was fetched + matched.
        await waitFor(() =>
            expect(
                screen.getByTestId('card-onboarding-waitlist-join'),
            ).toBeTruthy(),
        )
    })
})

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
import { Notifier } from 'react-native-notifier'

import { server } from '@test-utils/msw-server'
import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import { registerBottomSheet } from '@modules/bottom-sheet'
import { CardCountryPickerContent } from '@modules/card/components/CardCountryPicker'
import { CardOnboardingEmailScreen } from '@modules/card/screens/CardOnboardingEmailScreen'
import { CardOnboardingEmailVerifyScreen } from '@modules/card/screens/CardOnboardingEmailVerifyScreen'

// Raw GET /v1/auth/settings shape (already camelCase; see the card package's
// registrationSettingsResponseSchema). RU is ineligible so it must be hidden.
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

const renderFlow = () =>
    renderWithNavigation(CardOnboardingEmailScreen, 'CardOnboardingEmail', {
        additionalScreens: [
            {
                name: 'CardOnboardingEmailVerify',
                component: CardOnboardingEmailVerifyScreen,
            },
        ],
    })

// Enter a valid email, open the country picker, and select the UK.
const enterEmailAndCountry = async () => {
    fireEvent.change(screen.getByTestId('card-onboarding-email-input'), {
        target: { value: 'john@example.com' },
    })

    fireEvent.click(screen.getByTestId('card-onboarding-country-field'))
    await waitFor(() =>
        expect(screen.getByTestId('card-country-GB')).toBeTruthy(),
    )
    // Ineligible countries are filtered out.
    expect(screen.queryByTestId('card-country-RU')).toBeNull()

    fireEvent.click(screen.getByTestId('card-country-GB'))
    // Selecting resolves + closes the sheet (and sets the form's country).
    await waitFor(() =>
        expect(screen.queryByTestId('card-country-GB')).toBeNull(),
    )
}

describe('Flow: Card onboarding — email + country', () => {
    beforeAll(() => {
        server.listen({ onUnhandledRequest: 'warn' })
        // registrations.ts runs at app bootstrap (RootComponent), not in the
        // test harness — register the picker the flow opens by string key.
        registerBottomSheet('card-country-picker', CardCountryPickerContent)
    })
    beforeEach(() => vi.mocked(Notifier.showNotification).mockClear())
    afterEach(() => server.resetHandlers())
    afterAll(() => server.close())

    it('Given a valid email and an eligible country, when Confirm is pressed, then the code is sent and the verification screen opens', async () => {
        const sendSpy = vi.fn(() => HttpResponse.json({}, { status: 200 }))
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
})

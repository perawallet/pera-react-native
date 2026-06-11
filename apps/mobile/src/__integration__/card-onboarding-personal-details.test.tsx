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
import { useCardStore } from '@perawallet/wallet-core-card'

import { server } from '@test-utils/msw-server'
import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import { CardOnboardingPersonalDetailsScreen } from '@modules/card/screens/CardOnboardingPersonalDetailsScreen'
import { CardOnboardingEmailVerifyScreen } from '@modules/card/screens/CardOnboardingEmailVerifyScreen'
import { CardOnboardingAddressScreen } from '@modules/card/screens/CardOnboardingAddressScreen'

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

// The screen reads the onboarding id from the store (no nav params), so seed it.
const renderFlow = () =>
    renderWithNavigation(
        CardOnboardingPersonalDetailsScreen,
        'CardOnboardingPersonalDetails',
        {
            additionalScreens: [
                {
                    name: 'CardOnboardingEmailVerify',
                    component: CardOnboardingEmailVerifyScreen,
                },
                {
                    name: 'CardOnboardingAddress',
                    component: CardOnboardingAddressScreen,
                },
            ],
        },
    )

// Fill only the name + date fields, leaving nationality to the preselect.
const fillNameAndDob = () => {
    fireEvent.change(screen.getByTestId('card-onboarding-first-name-input'), {
        target: { value: 'John' },
    })
    fireEvent.change(screen.getByTestId('card-onboarding-last-name-input'), {
        target: { value: 'Morgan' },
    })
    // Typed without slashes — the mask inserts them.
    fireEvent.change(screen.getByTestId('card-onboarding-dob-input'), {
        target: { value: '27021986' },
    })
}

// Fill the name + date fields and pick the UK as nationality so the form validates.
const fillFormAndPickNationality = async () => {
    fillNameAndDob()

    fireEvent.click(screen.getByTestId('card-onboarding-nationality-field'))
    await waitFor(() =>
        expect(screen.getByTestId('card-country-GB')).toBeTruthy(),
    )
    fireEvent.click(screen.getByTestId('card-country-GB'))
    await waitFor(() =>
        expect(screen.queryByTestId('card-country-GB')).toBeNull(),
    )
}

describe('Flow: Card onboarding — personal details', () => {
    beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }))
    beforeEach(() => {
        vi.mocked(Notifier.showNotification).mockClear()
        const store = useCardStore.getState()
        store.resetState()
        store.setEmail('john@example.com')
        store.setCountryIso('GB')
        store.setOnboardingId('mock-onboarding-id')
        server.use(
            http.get('*/v1/auth/settings', () =>
                HttpResponse.json(SETTINGS_RESPONSE, { status: 200 }),
            ),
        )
    })
    afterEach(() => server.resetHandlers())
    afterAll(() => server.close())

    it('Given a complete form, when Continue is pressed, then the details post with an ISO date of birth', async () => {
        let body: Record<string, unknown> | undefined
        const submitSpy = vi.fn()
        server.use(
            http.post(
                '*/v1/auth/register/personal-details',
                async ({ request }) => {
                    body = (await request.json()) as Record<string, unknown>
                    submitSpy()
                    return HttpResponse.json({}, { status: 200 })
                },
            ),
        )

        renderFlow()
        await fillFormAndPickNationality()

        const confirm = screen.getByTestId(
            'card-onboarding-personal-details-confirm',
        )
        await waitFor(() => expect(confirm.getAttribute('disabled')).toBeNull())
        fireEvent.click(confirm)

        await waitFor(() => expect(submitSpy).toHaveBeenCalled())
        expect(body).toMatchObject({
            onboardingId: 'mock-onboarding-id',
            firstName: 'John',
            lastName: 'Morgan',
            // DD/MM/YYYY entry is converted to the API's ISO format.
            dateOfBirth: '1986-02-27',
            countryOfNationality: 'GB',
        })
        // A successful submit advances the flow to the residential-address step.
        await waitFor(() =>
            expect(screen.getByTestId('card-onboarding-address')).toBeTruthy(),
        )
    })

    it('Given a residence country, when the screen opens, then nationality is preselected so name + date alone enable Continue', async () => {
        let body: Record<string, unknown> | undefined
        const submitSpy = vi.fn()
        server.use(
            http.post(
                '*/v1/auth/register/personal-details',
                async ({ request }) => {
                    body = (await request.json()) as Record<string, unknown>
                    submitSpy()
                    return HttpResponse.json({}, { status: 200 })
                },
            ),
        )

        renderFlow()
        // No manual nationality pick — the residence country (GB) is preselected.
        fillNameAndDob()

        const confirm = screen.getByTestId(
            'card-onboarding-personal-details-confirm',
        )
        await waitFor(() => expect(confirm.getAttribute('disabled')).toBeNull())
        fireEvent.click(confirm)

        await waitFor(() => expect(submitSpy).toHaveBeenCalled())
        expect(body).toMatchObject({ countryOfNationality: 'GB' })
    })

    it('Given an impossible date of birth, when the field is blurred, then the inline error shows', async () => {
        renderFlow()
        const dob = screen.getByTestId('card-onboarding-dob-input')

        // 31 Feb — masked into DD/MM/YYYY but rejected by the schema.
        fireEvent.change(dob, { target: { value: '31021990' } })
        // No error while still typing (showErrorOnBlur).
        expect(dob.getAttribute('errormessage')).toBeFalsy()

        fireEvent.blur(dob)
        await waitFor(() =>
            expect(
                screen
                    .getByTestId('card-onboarding-dob-input')
                    .getAttribute('errormessage'),
            ).toBe('peraCard.personal_details.dob_invalid'),
        )
    })

    it('Given the submit fails, when Continue is pressed, then an error toast shows and the flow stays put', async () => {
        server.use(
            http.post('*/v1/auth/register/personal-details', () =>
                HttpResponse.json({ message: 'nope' }, { status: 500 }),
            ),
        )

        renderFlow()
        await fillFormAndPickNationality()

        const confirm = screen.getByTestId(
            'card-onboarding-personal-details-confirm',
        )
        await waitFor(() => expect(confirm.getAttribute('disabled')).toBeNull())
        fireEvent.click(confirm)

        await waitFor(() =>
            expect(Notifier.showNotification).toHaveBeenCalled(),
        )
        expect(screen.queryByTestId('card-onboarding-email-verify')).toBeNull()
    })

    it('Given the onboarding id is missing, when Continue is pressed, then it routes back to email verification', async () => {
        useCardStore.getState().setOnboardingId(null)
        const submitSpy = vi.fn()
        server.use(
            http.post('*/v1/auth/register/personal-details', () => {
                submitSpy()
                return HttpResponse.json({}, { status: 200 })
            }),
        )

        renderFlow()
        await fillFormAndPickNationality()

        const confirm = screen.getByTestId(
            'card-onboarding-personal-details-confirm',
        )
        await waitFor(() => expect(confirm.getAttribute('disabled')).toBeNull())
        fireEvent.click(confirm)

        await waitFor(() =>
            expect(
                screen.getByTestId('card-onboarding-email-verify'),
            ).toBeTruthy(),
        )
        expect(submitSpy).not.toHaveBeenCalled()
    })
})

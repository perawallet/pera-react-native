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

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { Notifier } from 'react-native-notifier'
import { useCardStore } from '@perawallet/wallet-core-card'

import { server } from '@test-utils/msw-server'
import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import { CardOnboardingPersonalDetailsScreen } from '@modules/card/screens/CardOnboardingPersonalDetailsScreen'
import { CardOnboardingEmailVerifyScreen } from '@modules/card/screens/CardOnboardingEmailVerifyScreen'
import { CardOnboardingAddressScreen } from '@modules/card/screens/CardOnboardingAddressScreen'
import { getInputErrorMessage, isElementDisabled } from '@test-utils/rnw'
import {
    buildRegistrationSettingsResponse,
    settingsCountry,
} from './__fixtures__/cardRegistrationSettings'

const SETTINGS_RESPONSE = buildRegistrationSettingsResponse({
    countries: [
        settingsCountry('GB', 'United Kingdom', '44'),
        settingsCountry('US', 'United States of America'),
        settingsCountry('PT', 'Portugal', '351'),
        settingsCountry('ES', 'Spain', '34'),
    ],
})

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

const pickOption = async (fieldTestId: string, optionKey: string) => {
    fireEvent.click(screen.getByTestId(fieldTestId))
    const option = await screen.findByTestId(`card-option-${optionKey}`)
    fireEvent.click(option)
    await waitFor(() =>
        expect(screen.queryByTestId(`card-option-${optionKey}`)).toBeNull(),
    )
}

// Employment has no server prefill, so every complete form picks it.
const pickEmployment = async () => {
    await pickOption('card-onboarding-employment-status-field', 'employed')
    await pickOption(
        'card-onboarding-employment-sector-field',
        'informationTechnology',
    )
}

// Fill only the name + date fields, leaving nationality to the preselect. The
// form appears once the onboarding record has answered, so wait for it.
const fillNameAndDob = async () => {
    fireEvent.change(
        await screen.findByTestId('card-onboarding-first-name-input'),
        { target: { value: 'John' } },
    )
    fireEvent.change(screen.getByTestId('card-onboarding-last-name-input'), {
        target: { value: 'Morgan' },
    })
    // Typed without slashes — the mask inserts them.
    fireEvent.change(screen.getByTestId('card-onboarding-dob-input'), {
        target: { value: '27021986' },
    })
    await pickEmployment()
}

// Fill the name + date fields and pick the UK as nationality so the form validates.
const fillFormAndPickNationality = async () => {
    await fillNameAndDob()

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
            // Default: a record with no profile data yet, so the form stays
            // empty and editable. KYC only starts after the forms, so it is
            // still UNVERIFIED here. Prefill tests override this.
            http.get('*/v1/auth/register', () =>
                HttpResponse.json(
                    {
                        id: 'mock-onboarding-id',
                        verificationState: 'UNVERIFIED',
                        firstName: null,
                        lastName: null,
                        dateOfBirth: null,
                        countryOfNationality: null,
                    },
                    { status: 200 },
                ),
            ),
        )
    })

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

        const confirm = () =>
            screen.getByTestId('card-onboarding-personal-details-confirm')
        await waitFor(() => expect(isElementDisabled(confirm())).toBe(false))
        fireEvent.click(confirm())

        await waitFor(() => expect(submitSpy).toHaveBeenCalled())
        expect(body).toMatchObject({
            onboardingId: 'mock-onboarding-id',
            firstName: 'John',
            lastName: 'Morgan',
            // DD/MM/YYYY entry is converted to the API's ISO format.
            dateOfBirth: '1986-02-27',
            countryOfNationality: 'GB',
            countryOfBirth: 'GB',
            employmentStatus: 'employed',
            employmentSector: 'informationTechnology',
        })
        expect(body).not.toHaveProperty('middleName')
        expect(body).not.toHaveProperty('additionalNationalities')
        expect(body).not.toHaveProperty('portugalInvestmentScheme')
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
        await fillNameAndDob()

        const confirm = () =>
            screen.getByTestId('card-onboarding-personal-details-confirm')
        await waitFor(() => expect(isElementDisabled(confirm())).toBe(false))
        fireEvent.click(confirm())

        await waitFor(() => expect(submitSpy).toHaveBeenCalled())
        expect(body).toMatchObject({ countryOfNationality: 'GB' })
    })

    it('Given the onboarding record already has the details, when the screen opens, then the fields prefill read-only and submit without typing', async () => {
        let body: Record<string, unknown> | undefined
        const submitSpy = vi.fn()
        server.use(
            http.get('*/v1/auth/register', () =>
                HttpResponse.json(
                    {
                        id: 'mock-onboarding-id',
                        firstName: 'YASIN',
                        lastName: 'ÇALIŞKAN',
                        dateOfBirth: '1997-11-08T00:00:00.000Z',
                        verificationState: 'VERIFIED',
                        countryOfNationality: null,
                    },
                    { status: 200 },
                ),
            ),
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

        // The server-confirmed identity fields are populated from the record.
        await screen.findByTestId('card-onboarding-first-name-input')
        await pickEmployment()
        await waitFor(() =>
            expect(
                screen
                    .getByTestId('card-onboarding-first-name-input')
                    .getAttribute('value'),
            ).toBe('YASIN'),
        )
        expect(
            screen
                .getByTestId('card-onboarding-dob-input')
                .getAttribute('value'),
            // Server ISO datetime is shown in the masked DD/MM/YYYY format.
        ).toBe('08/11/1997')

        // Prefill plus the employment picks make the form valid, no typing needed.
        const confirm = () =>
            screen.getByTestId('card-onboarding-personal-details-confirm')
        await waitFor(() => expect(isElementDisabled(confirm())).toBe(false))
        fireEvent.click(confirm())

        await waitFor(() => expect(submitSpy).toHaveBeenCalled())
        expect(body).toMatchObject({
            firstName: 'YASIN',
            lastName: 'ÇALIŞKAN',
            // Server ISO datetime -> DD/MM/YYYY display -> ISO date on submit.
            dateOfBirth: '1997-11-08',
            // Nationality wasn't on the record, so the residence guess (GB) fills it.
            countryOfNationality: 'GB',
        })
    })

    it('Given a US resident, then the SSN is required and posted as nine digits', async () => {
        useCardStore.getState().setCountryIso('US')
        let body: Record<string, unknown> | undefined
        server.use(
            http.post(
                '*/v1/auth/register/personal-details',
                async ({ request }) => {
                    body = (await request.json()) as Record<string, unknown>
                    return HttpResponse.json({}, { status: 200 })
                },
            ),
        )

        renderFlow()
        await fillNameAndDob()

        // Nationality and birth country preselect from the residence (US), so
        // the SSN is the only thing holding Continue back.
        const confirm = () =>
            screen.getByTestId('card-onboarding-personal-details-confirm')
        await waitFor(() =>
            expect(
                screen.getByTestId('card-onboarding-ssn-input'),
            ).toBeTruthy(),
        )
        expect(isElementDisabled(confirm())).toBe(true)

        // Typed without dashes; the mask inserts them.
        fireEvent.change(screen.getByTestId('card-onboarding-ssn-input'), {
            target: { value: '123456789' },
        })
        await waitFor(() => expect(isElementDisabled(confirm())).toBe(false))
        fireEvent.click(confirm())

        await waitFor(() =>
            expect(body).toMatchObject({
                countryOfNationality: 'US',
                ssn: '123456789',
            }),
        )
    })

    it('Given a Portugal resident with a middle name and a second nationality, when Continue is pressed, then all of them post', async () => {
        useCardStore.getState().setCountryIso('PT')
        let body: Record<string, unknown> | undefined
        server.use(
            http.post(
                '*/v1/auth/register/personal-details',
                async ({ request }) => {
                    body = (await request.json()) as Record<string, unknown>
                    return HttpResponse.json(
                        { user: { phase: 'ADDITIONAL_DETAILS' } },
                        { status: 200 },
                    )
                },
            ),
        )

        renderFlow()
        await fillNameAndDob()
        fireEvent.change(
            screen.getByTestId('card-onboarding-middle-name-input'),
            { target: { value: 'James' } },
        )
        fireEvent.click(screen.getByTestId('card-onboarding-add-nationality'))
        fireEvent.click(await screen.findByTestId('card-country-ES'))
        await screen.findByTestId(
            'card-onboarding-additional-nationality-field-0',
        )
        fireEvent.click(
            screen.getByTestId('card-onboarding-portugal-scheme-checkbox'),
        )

        const confirm = () =>
            screen.getByTestId('card-onboarding-personal-details-confirm')
        await waitFor(() => expect(isElementDisabled(confirm())).toBe(false))
        fireEvent.click(confirm())

        await waitFor(() =>
            expect(body).toMatchObject({
                middleName: 'James',
                countryOfNationality: 'PT',
                additionalNationalities: ['ES'],
                portugalInvestmentScheme: true,
            }),
        )
    })

    it('Given an extra nationality equal to the main one, then the duplicate error shows and Continue stays gated', async () => {
        renderFlow()
        await fillNameAndDob()

        fireEvent.click(screen.getByTestId('card-onboarding-add-nationality'))
        fireEvent.click(await screen.findByTestId('card-country-GB'))

        expect(
            await screen.findByTestId(
                'card-onboarding-additional-nationality-error',
            ),
        ).toBeTruthy()
        expect(
            isElementDisabled(
                screen.getByTestId('card-onboarding-personal-details-confirm'),
            ),
        ).toBe(true)

        fireEvent.click(
            screen.getByTestId('card-onboarding-remove-nationality-0'),
        )
        await waitFor(() =>
            expect(
                screen.queryByTestId(
                    'card-onboarding-additional-nationality-error',
                ),
            ).toBeNull(),
        )
    })

    it('Given an impossible date of birth, when the field is blurred, then the inline error shows', async () => {
        renderFlow()
        const dob = await screen.findByTestId('card-onboarding-dob-input')

        // 31 Feb — masked into DD/MM/YYYY but rejected by the schema.
        fireEvent.change(dob, { target: { value: '31021990' } })
        // No error while still typing (showErrorOnBlur).
        expect(getInputErrorMessage(dob)).toBeFalsy()

        fireEvent.blur(dob)
        await waitFor(() =>
            expect(
                getInputErrorMessage(
                    screen.getByTestId('card-onboarding-dob-input'),
                ),
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

        const confirm = () =>
            screen.getByTestId('card-onboarding-personal-details-confirm')
        await waitFor(() => expect(isElementDisabled(confirm())).toBe(false))
        fireEvent.click(confirm())

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

        const confirm = () =>
            screen.getByTestId('card-onboarding-personal-details-confirm')
        await waitFor(() => expect(isElementDisabled(confirm())).toBe(false))
        fireEvent.click(confirm())

        await waitFor(() =>
            expect(
                screen.getByTestId('card-onboarding-email-verify'),
            ).toBeTruthy(),
        )
        expect(submitSpy).not.toHaveBeenCalled()
    })
})

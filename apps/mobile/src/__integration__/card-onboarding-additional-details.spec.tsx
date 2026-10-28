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
import { isElementDisabled } from '@test-utils/rnw'
import { CardOnboardingPersonalDetailsScreen } from '@modules/card/screens/CardOnboardingPersonalDetailsScreen'
import { CardOnboardingAdditionalDetailsScreen } from '@modules/card/screens/CardOnboardingAdditionalDetailsScreen'
import { CardOnboardingAddressScreen } from '@modules/card/screens/CardOnboardingAddressScreen'
import { CardOnboardingEmailVerifyScreen } from '@modules/card/screens/CardOnboardingEmailVerifyScreen'
import { CardOnboardingVerificationScreen } from '@modules/card/screens/CardOnboardingVerificationScreen'
import {
    buildRegistrationSettingsResponse,
    OTHER_OCCUPATION_KEY,
    settingsCountry,
} from './__fixtures__/cardRegistrationSettings'

const SETTINGS_RESPONSE = buildRegistrationSettingsResponse({
    countries: [
        settingsCountry('PT', 'Portugal', '351'),
        settingsCountry('ES', 'Spain', '34'),
        settingsCountry('US', 'United States of America'),
    ],
})

const ADDITIONAL_SCREENS = [
    {
        name: 'CardOnboardingAdditionalDetails',
        component: CardOnboardingAdditionalDetailsScreen,
    },
    { name: 'CardOnboardingAddress', component: CardOnboardingAddressScreen },
    {
        name: 'CardOnboardingEmailVerify',
        component: CardOnboardingEmailVerifyScreen,
    },
    {
        name: 'CardOnboardingVerification',
        component: CardOnboardingVerificationScreen,
    },
]

const pickOption = async (fieldTestId: string, optionKey: string) => {
    fireEvent.click(screen.getByTestId(fieldTestId))
    fireEvent.click(await screen.findByTestId(`card-option-${optionKey}`))
    await waitFor(() =>
        expect(screen.queryByTestId(`card-option-${optionKey}`)).toBeNull(),
    )
}

const fillAdditionalDetails = async () => {
    fireEvent.change(await screen.findByTestId('card-onboarding-tin-input'), {
        target: { value: '123456789' },
    })
    fireEvent.change(
        screen.getByTestId('card-onboarding-annual-income-input'),
        {
            target: { value: '30000' },
        },
    )
    await pickOption('card-onboarding-occupation-field', OTHER_OCCUPATION_KEY)
    fireEvent.change(
        await screen.findByTestId('card-onboarding-occupation-other-input'),
        { target: { value: 'Beekeeper' } },
    )
    await pickOption(
        'card-onboarding-source-of-wealth-field',
        'employment_salaried',
    )
    await pickOption(
        'card-onboarding-business-sector-field',
        'information_and_communication',
    )
}

const confirm = () =>
    screen.getByTestId('card-onboarding-additional-details-confirm')

describe('Flow: Card onboarding, additional details', () => {
    beforeEach(() => {
        vi.mocked(Notifier.showNotification).mockClear()
        const store = useCardStore.getState()
        store.resetState()
        store.setEmail('joao@example.com')
        store.setCountryIso('PT')
        store.setOnboardingId('mock-onboarding-id')
        server.use(
            http.get('*/v1/auth/settings', () =>
                HttpResponse.json(SETTINGS_RESPONSE, { status: 200 }),
            ),
            http.get('*/v1/auth/register', () =>
                HttpResponse.json(
                    {
                        id: 'mock-onboarding-id',
                        verificationState: 'PENDING',
                        phase: 'ADDITIONAL_DETAILS',
                        countryOfResidence: 'PT',
                    },
                    { status: 200 },
                ),
            ),
        )
    })

    it('Given Baanx asks for additional details, when personal details are saved, then the additional details step opens', async () => {
        server.use(
            http.post('*/v1/auth/register/personal-details', () =>
                HttpResponse.json(
                    { user: { phase: 'ADDITIONAL_DETAILS' } },
                    { status: 200 },
                ),
            ),
        )

        renderWithNavigation(
            CardOnboardingPersonalDetailsScreen,
            'CardOnboardingPersonalDetails',
            { additionalScreens: ADDITIONAL_SCREENS },
        )
        fireEvent.change(
            await screen.findByTestId('card-onboarding-first-name-input'),
            { target: { value: 'João' } },
        )
        fireEvent.change(
            screen.getByTestId('card-onboarding-last-name-input'),
            { target: { value: 'Silva' } },
        )
        fireEvent.change(screen.getByTestId('card-onboarding-dob-input'), {
            target: { value: '27021986' },
        })
        await pickOption('card-onboarding-employment-status-field', 'employed')
        await pickOption(
            'card-onboarding-employment-sector-field',
            'informationTechnology',
        )
        const personalConfirm = () =>
            screen.getByTestId('card-onboarding-personal-details-confirm')
        await waitFor(() =>
            expect(isElementDisabled(personalConfirm())).toBe(false),
        )
        fireEvent.click(personalConfirm())

        expect(
            await screen.findByTestId('card-onboarding-additional-details'),
        ).toBeTruthy()
    })

    it('Given a complete form, when Continue is pressed, then the details post and the address step opens', async () => {
        let body: Record<string, unknown> | undefined
        server.use(
            http.post(
                '*/v1/auth/register/additional-details',
                async ({ request }) => {
                    body = (await request.json()) as Record<string, unknown>
                    return HttpResponse.json(
                        { user: { phase: 'PHYSICAL_ADDRESS' } },
                        { status: 200 },
                    )
                },
            ),
        )

        renderWithNavigation(
            CardOnboardingAdditionalDetailsScreen,
            'CardOnboardingAdditionalDetails',
            { additionalScreens: ADDITIONAL_SCREENS },
        )
        await fillAdditionalDetails()
        fireEvent.click(
            screen.getByTestId('card-onboarding-add-income-country'),
        )
        fireEvent.click(await screen.findByTestId('card-country-ES'))
        await screen.findByTestId('card-onboarding-income-country-field-1')

        await waitFor(() => expect(isElementDisabled(confirm())).toBe(false))
        fireEvent.click(confirm())

        await waitFor(() =>
            expect(screen.getByTestId('card-onboarding-address')).toBeTruthy(),
        )
        expect(body).toEqual({
            onboardingId: 'mock-onboarding-id',
            tin: '123456789',
            // Both country fields default to the residence.
            tinCountry: 'PT',
            occupation: OTHER_OCCUPATION_KEY,
            occupationOther: 'Beekeeper',
            sourceOfWealth: 'employment_salaried',
            businessSector: 'information_and_communication',
            estimatedAnnualIncome: '30000',
            incomeCountries: ['PT', 'ES'],
        })
    })

    it('Given Baanx is still loading its lists, when Continue is pressed, then a retry message shows and the step stays put', async () => {
        server.use(
            http.post('*/v1/auth/register/additional-details', () =>
                HttpResponse.json(
                    {
                        message:
                            'Risk standards are unavailable, try again later',
                    },
                    { status: 503 },
                ),
            ),
        )

        renderWithNavigation(
            CardOnboardingAdditionalDetailsScreen,
            'CardOnboardingAdditionalDetails',
            { additionalScreens: ADDITIONAL_SCREENS },
        )
        await fillAdditionalDetails()
        await waitFor(() => expect(isElementDisabled(confirm())).toBe(false))
        fireEvent.click(confirm())

        await waitFor(() =>
            expect(Notifier.showNotification).toHaveBeenCalledWith(
                expect.objectContaining({
                    title: 'peraCard.additional_details.unavailable_title',
                }),
            ),
        )
        expect(screen.queryByTestId('card-onboarding-address')).toBeNull()
    })

    it('Given a US TIN country, then Continue stays gated', async () => {
        renderWithNavigation(
            CardOnboardingAdditionalDetailsScreen,
            'CardOnboardingAdditionalDetails',
            { additionalScreens: ADDITIONAL_SCREENS },
        )
        await fillAdditionalDetails()
        await waitFor(() => expect(isElementDisabled(confirm())).toBe(false))

        fireEvent.click(screen.getByTestId('card-onboarding-tin-country-field'))
        fireEvent.click(await screen.findByTestId('card-country-US'))

        await waitFor(() => expect(isElementDisabled(confirm())).toBe(true))
    })
})

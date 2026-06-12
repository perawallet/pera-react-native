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
import { OnboardingStep, useCardStore } from '@perawallet/wallet-core-card'

import { server } from '@test-utils/msw-server'
import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import { CardOnboardingAddressScreen } from '@modules/card/screens/CardOnboardingAddressScreen'
import { CardOnboardingEmailVerifyScreen } from '@modules/card/screens/CardOnboardingEmailVerifyScreen'

// The final registration step returns the access token + onboarding id.
const ADDRESS_RESPONSE = {
    accessToken: 'mock-access-token',
    onboardingId: 'mock-onboarding-id',
}

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
            id: 'us',
            iso3166alpha2: 'US',
            name: 'United States',
            callingCode: '1',
            canSignUp: true,
        },
    ],
    usStates: [
        {
            id: 'ca',
            name: 'California',
            postalAbbreviation: 'CA',
            canSignUp: true,
        },
        {
            id: 'ny',
            name: 'New York',
            postalAbbreviation: 'NY',
            canSignUp: true,
        },
    ],
}

// The screen reads the onboarding id + residence country from the store, so seed it.
const renderFlow = () =>
    renderWithNavigation(CardOnboardingAddressScreen, 'CardOnboardingAddress', {
        additionalScreens: [
            {
                name: 'CardOnboardingEmailVerify',
                component: CardOnboardingEmailVerifyScreen,
            },
        ],
    })

const fillAddressFields = () => {
    fireEvent.change(screen.getByTestId('card-onboarding-address-city-input'), {
        target: { value: 'Sheffield' },
    })
    fireEvent.change(screen.getByTestId('card-onboarding-address-zip-input'), {
        target: { value: 'S17 3RA' },
    })
    fireEvent.change(
        screen.getByTestId('card-onboarding-address-line1-input'),
        { target: { value: '3 Ryecroft Glen Road' } },
    )
}

const acceptBothTerms = () => {
    fireEvent.click(
        screen.getByTestId('card-onboarding-address-card-terms-checkbox'),
    )
    fireEvent.click(
        screen.getByTestId('card-onboarding-address-platform-terms-checkbox'),
    )
}

describe('Flow: Card onboarding — residential address', () => {
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
            // Consent (T&Cs + marketing) posts just before the address on the
            // final step; default it to success.
            http.post('*/v2/consent/onboarding', () =>
                HttpResponse.json({ success: true }, { status: 200 }),
            ),
        )
    })
    afterEach(() => server.resetHandlers())
    afterAll(() => server.close())

    it('Given a complete UK address and accepted terms, when Continue is pressed, then the address posts with isSameMailingAddress true and registration completes', async () => {
        let body: Record<string, unknown> | undefined
        let consentBody: Record<string, unknown> | undefined
        const submitSpy = vi.fn()
        server.use(
            http.post('*/v2/consent/onboarding', async ({ request }) => {
                consentBody = (await request.json()) as Record<string, unknown>
                return HttpResponse.json({ success: true }, { status: 200 })
            }),
            http.post('*/v1/auth/register/address', async ({ request }) => {
                body = (await request.json()) as Record<string, unknown>
                submitSpy()
                return HttpResponse.json(ADDRESS_RESPONSE, { status: 200 })
            }),
        )

        renderFlow()
        fillAddressFields()
        acceptBothTerms()

        const confirm = screen.getByTestId('card-onboarding-address-confirm')
        await waitFor(() => expect(confirm.getAttribute('disabled')).toBeNull())
        fireEvent.click(confirm)

        await waitFor(() => expect(submitSpy).toHaveBeenCalled())
        expect(body).toMatchObject({
            onboardingId: 'mock-onboarding-id',
            addressLine1: '3 Ryecroft Glen Road',
            city: 'Sheffield',
            zip: 'S17 3RA',
            isSameMailingAddress: true,
        })
        // No US residence, so no state is sent.
        expect(body?.usState).toBeUndefined()
        // Consent (T&Cs + marketing) is recorded before the address submit.
        expect(consentBody).toMatchObject({
            onboardingId: 'mock-onboarding-id',
            allowMarketing: true,
            cardTermsAccepted: true,
            platformTermsAccepted: true,
        })
        // Address is the final step: the screen swaps to its completion state
        // and onboarding is marked done.
        await waitFor(() =>
            expect(
                screen.getByTestId('card-onboarding-address-success'),
            ).toBeTruthy(),
        )
        expect(useCardStore.getState().onboardingStep).toBe(
            OnboardingStep.Completed,
        )
    })

    it('keeps Continue disabled until both Terms & Conditions are accepted', async () => {
        renderFlow()
        fillAddressFields()

        const confirm = screen.getByTestId('card-onboarding-address-confirm')
        // Address is valid but the T&Cs gate the button.
        expect(confirm.getAttribute('disabled')).not.toBeNull()

        acceptBothTerms()
        await waitFor(() => expect(confirm.getAttribute('disabled')).toBeNull())
    })

    it('Given a US residence, when Continue is pressed, then the picked state is posted', async () => {
        useCardStore.getState().setCountryIso('US')
        let body: Record<string, unknown> | undefined
        const submitSpy = vi.fn()
        server.use(
            http.post('*/v1/auth/register/address', async ({ request }) => {
                body = (await request.json()) as Record<string, unknown>
                submitSpy()
                return HttpResponse.json(ADDRESS_RESPONSE, { status: 200 })
            }),
        )

        renderFlow()
        // The US state field appears once the residence preselects to US.
        const stateField = await screen.findByTestId(
            'card-onboarding-address-state-field',
        )
        fillAddressFields()

        fireEvent.click(stateField)
        await waitFor(() =>
            expect(screen.getByTestId('card-us-state-CA')).toBeTruthy(),
        )
        fireEvent.click(screen.getByTestId('card-us-state-CA'))
        await waitFor(() =>
            expect(screen.queryByTestId('card-us-state-CA')).toBeNull(),
        )

        acceptBothTerms()
        const confirm = screen.getByTestId('card-onboarding-address-confirm')
        await waitFor(() => expect(confirm.getAttribute('disabled')).toBeNull())
        fireEvent.click(confirm)

        await waitFor(() => expect(submitSpy).toHaveBeenCalled())
        expect(body).toMatchObject({
            usState: 'CA',
            isSameMailingAddress: true,
        })
    })

    it('Given the submit fails, when Continue is pressed, then an error toast shows and the flow stays put', async () => {
        server.use(
            http.post('*/v1/auth/register/address', () =>
                HttpResponse.json({ message: 'nope' }, { status: 500 }),
            ),
        )

        renderFlow()
        fillAddressFields()
        acceptBothTerms()

        const confirm = screen.getByTestId('card-onboarding-address-confirm')
        await waitFor(() => expect(confirm.getAttribute('disabled')).toBeNull())
        fireEvent.click(confirm)

        await waitFor(() =>
            expect(Notifier.showNotification).toHaveBeenCalled(),
        )
        expect(screen.queryByTestId('card-onboarding-email-verify')).toBeNull()
    })

    it('Given the consent call fails, when Continue is pressed, then an error toast shows and the address is not submitted', async () => {
        const addressSpy = vi.fn()
        server.use(
            http.post('*/v2/consent/onboarding', () =>
                HttpResponse.json({ message: 'nope' }, { status: 500 }),
            ),
            http.post('*/v1/auth/register/address', () => {
                addressSpy()
                return HttpResponse.json(ADDRESS_RESPONSE, { status: 200 })
            }),
        )

        renderFlow()
        fillAddressFields()
        acceptBothTerms()

        const confirm = screen.getByTestId('card-onboarding-address-confirm')
        await waitFor(() => expect(confirm.getAttribute('disabled')).toBeNull())
        fireEvent.click(confirm)

        await waitFor(() =>
            expect(Notifier.showNotification).toHaveBeenCalled(),
        )
        // Consent gates the finalize: a failed consent must not submit the address.
        expect(addressSpy).not.toHaveBeenCalled()
        expect(
            screen.queryByTestId('card-onboarding-address-success'),
        ).toBeNull()
    })

    it('Given the onboarding id is missing, when Continue is pressed, then it routes back to email verification', async () => {
        useCardStore.getState().setOnboardingId(null)
        const submitSpy = vi.fn()
        server.use(
            http.post('*/v1/auth/register/address', () => {
                submitSpy()
                return HttpResponse.json(ADDRESS_RESPONSE, { status: 200 })
            }),
        )

        renderFlow()
        fillAddressFields()
        acceptBothTerms()

        const confirm = screen.getByTestId('card-onboarding-address-confirm')
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

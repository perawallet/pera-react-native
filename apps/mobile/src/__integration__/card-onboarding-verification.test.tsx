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
import { Linking } from 'react-native'
import { OnboardingStep, useCardStore } from '@perawallet/wallet-core-card'

import { server } from '@test-utils/msw-server'
import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import { CardOnboardingVerificationScreen } from '@modules/card/screens/CardOnboardingVerificationScreen'
import { CardOnboardingPersonalDetailsScreen } from '@modules/card/screens/CardOnboardingPersonalDetailsScreen'

const SESSION_URL = 'https://veriff.example/dev-session'

// KYC verified → the flow advances to the personal-details step.
const renderFlow = () =>
    renderWithNavigation(
        CardOnboardingVerificationScreen,
        'CardOnboardingVerification',
        {
            additionalScreens: [
                {
                    name: 'CardOnboardingPersonalDetails',
                    component: CardOnboardingPersonalDetailsScreen,
                },
            ],
        },
    )

const mockStartVerification = () =>
    server.use(
        http.post('*/v1/auth/register/verification', () =>
            HttpResponse.json({ sessionUrl: SESSION_URL }, { status: 200 }),
        ),
    )

const mockOnboardingDetails = (verificationState: string) =>
    server.use(
        http.get('*/v1/auth/register', () =>
            HttpResponse.json(
                { id: 'mock-onboarding-id', verificationState },
                { status: 200 },
            ),
        ),
    )

describe('Flow: Card onboarding — identity verification', () => {
    beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }))
    beforeEach(() => {
        const store = useCardStore.getState()
        store.resetState()
        store.setOnboardingId('mock-onboarding-id')
        store.setCountryIso('GB')
        vi.spyOn(Linking, 'openURL').mockResolvedValue(true)
        // The personal-details screen fetches the registration settings for
        // its nationality picker on mount.
        server.use(
            http.get('*/v1/auth/settings', () =>
                HttpResponse.json(
                    { countries: [], usStates: [] },
                    { status: 200 },
                ),
            ),
        )
    })
    afterEach(() => {
        server.resetHandlers()
        vi.restoreAllMocks()
    })
    afterAll(() => server.close())

    it('Given the verification screen, when Start is pressed, then the Veriff session URL opens', async () => {
        mockStartVerification()

        renderFlow()
        fireEvent.click(screen.getByTestId('card-onboarding-verification-cta'))

        await waitFor(() =>
            expect(Linking.openURL).toHaveBeenCalledWith(SESSION_URL),
        )
    })

    it('Given verification becomes VERIFIED, then the flow advances to personal details', async () => {
        mockStartVerification()
        mockOnboardingDetails('VERIFIED')

        renderFlow()
        fireEvent.click(screen.getByTestId('card-onboarding-verification-cta'))

        await waitFor(() =>
            expect(useCardStore.getState().onboardingStep).toBe(
                OnboardingStep.PersonalDetails,
            ),
        )
        await waitFor(() =>
            expect(
                screen.getByTestId('card-onboarding-personal-details'),
            ).toBeTruthy(),
        )
    })

    it('Given verification is PENDING, then the user can continue to personal details', async () => {
        mockStartVerification()
        mockOnboardingDetails('PENDING')

        renderFlow()
        fireEvent.click(screen.getByTestId('card-onboarding-verification-cta'))

        // Submitted state: Baanx reviews async; the CTA continues the flow.
        // (t() returns raw keys in the integration harness.)
        await screen.findByText('peraCard.verification.submitted_title')
        fireEvent.click(screen.getByTestId('card-onboarding-verification-cta'))

        await waitFor(() =>
            expect(
                screen.getByTestId('card-onboarding-personal-details'),
            ).toBeTruthy(),
        )
        expect(useCardStore.getState().onboardingStep).toBe(
            OnboardingStep.PersonalDetails,
        )
    })
})

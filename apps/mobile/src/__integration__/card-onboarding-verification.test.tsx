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
import { Linking } from 'react-native'
import { OnboardingStep, useCardStore } from '@perawallet/wallet-core-card'

import { server } from '@test-utils/msw-server'
import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import { CardOnboardingVerificationScreen } from '@modules/card/screens/CardOnboardingVerificationScreen'
import { CardOnboardingStatusScreen } from '@modules/card/screens/CardOnboardingStatusScreen'
import { CardOnboardingPersonalDetailsScreen } from '@modules/card/screens/CardOnboardingPersonalDetailsScreen'

const SESSION_URL = 'https://veriff.example/dev-session'

// KYC entry → setup-status checklist → personal details.
const renderFlow = () =>
    renderWithNavigation(
        CardOnboardingVerificationScreen,
        'CardOnboardingVerification',
        {
            additionalScreens: [
                {
                    name: 'CardOnboardingStatus',
                    component: CardOnboardingStatusScreen,
                },
                {
                    name: 'CardOnboardingPersonalDetails',
                    component: CardOnboardingPersonalDetailsScreen,
                },
            ],
        },
    )

// The setup checklist on its own, for the Connect Funds states.
const renderStatus = () =>
    renderWithNavigation(CardOnboardingStatusScreen, 'CardOnboardingStatus')

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
        vi.spyOn(Linking, 'canOpenURL').mockResolvedValue(true)
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

    it('Given the KYC entry, when Verify is pressed, then the Veriff session URL opens in the browser', async () => {
        mockStartVerification()

        renderFlow()
        fireEvent.click(screen.getByTestId('card-onboarding-verification-cta'))

        await waitFor(() =>
            expect(Linking.openURL).toHaveBeenCalledWith(SESSION_URL),
        )
    })

    it('Given Veriff reports PENDING, then the setup status shows the pending documents row', async () => {
        mockStartVerification()
        mockOnboardingDetails('PENDING')

        renderFlow()
        fireEvent.click(screen.getByTestId('card-onboarding-verification-cta'))

        // The poll confirms Veriff reported back → the checklist appears,
        // with step 1 pending while Baanx reviews.
        await waitFor(() =>
            expect(screen.getByTestId('card-onboarding-status')).toBeTruthy(),
        )
        expect(
            screen.getByTestId('card-onboarding-status-pending-label'),
        ).toBeTruthy()
    })

    it('Given the KYC was never completed (UNVERIFIED), then the row prompts to verify and Enter Details stays locked', async () => {
        // The bug: an abandoned KYC showed the "Pending" (submitted) row and
        // enabled the Enter Details step. It must instead prompt to verify and
        // keep the later steps locked.
        mockOnboardingDetails('UNVERIFIED')

        renderStatus()

        await waitFor(() =>
            expect(
                screen.getByTestId('card-onboarding-status-documents-verify'),
            ).toBeTruthy(),
        )
        // Not shown as submitted/pending, and the details step is not unlocked.
        expect(
            screen.queryByTestId('card-onboarding-status-pending-label'),
        ).toBeNull()
        expect(
            screen.queryByTestId('card-onboarding-status-details-cta'),
        ).toBeNull()
    })

    it('Given the identity is VERIFIED, then Enter Your Details continues to personal details', async () => {
        mockStartVerification()
        mockOnboardingDetails('VERIFIED')

        renderFlow()
        fireEvent.click(screen.getByTestId('card-onboarding-verification-cta'))

        await waitFor(() =>
            expect(screen.getByTestId('card-onboarding-status')).toBeTruthy(),
        )
        // Verified: no pending label; the details CTA continues the flow.
        expect(
            screen.queryByTestId('card-onboarding-status-pending-label'),
        ).toBeNull()
        fireEvent.click(
            screen.getByTestId('card-onboarding-status-details-cta'),
        )

        await waitFor(() =>
            expect(
                screen.getByTestId('card-onboarding-personal-details'),
            ).toBeTruthy(),
        )
        expect(useCardStore.getState().onboardingStep).toBe(
            OnboardingStep.PersonalDetails,
        )
    })

    it('Given registration is incomplete, then the Connect Funds row stays inactive', () => {
        mockOnboardingDetails('VERIFIED')

        renderStatus()

        // Before registration completes there's no connect CTA — just the stub.
        expect(
            screen.getByTestId('card-onboarding-status-connect-funds'),
        ).toBeTruthy()
        expect(
            screen.queryByTestId('card-onboarding-status-connect-cta'),
        ).toBeNull()
    })

    it('Given registration is complete, then the Connect a Pera Account button shows', async () => {
        mockOnboardingDetails('VERIFIED')
        useCardStore.getState().setOnboardingStep(OnboardingStep.Completed)

        renderStatus()

        await waitFor(() =>
            expect(
                screen.getByTestId('card-onboarding-status-connect-cta'),
            ).toBeTruthy(),
        )
    })

    it('Given a funding source is already connected, then the row shows it as done', async () => {
        mockOnboardingDetails('VERIFIED')
        useCardStore.getState().setOnboardingStep(OnboardingStep.Completed)
        useCardStore
            .getState()
            .setConnectedFundingSourceAddress(
                'GD64YIY3TWGDMCNPP553DZPPR6LDUSFQOIJVFDPPXWEG3FVOJCCDBBHU5A',
            )

        renderStatus()

        await waitFor(() =>
            expect(
                screen.getByTestId('card-onboarding-status-connected-account'),
            ).toBeTruthy(),
        )
        // Connected: the CTA is replaced by the connected account + a Change link.
        expect(
            screen.queryByTestId('card-onboarding-status-connect-cta'),
        ).toBeNull()
        expect(
            screen.getByTestId('card-onboarding-status-change-account'),
        ).toBeTruthy()
    })
})

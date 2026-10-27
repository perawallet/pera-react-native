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

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { Linking } from 'react-native'
import {
    clearCardSession,
    OnboardingStep,
    useCardStore,
} from '@perawallet/wallet-core-card'

import { server } from '@test-utils/msw-server'
import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import { isElementDisabled } from '@test-utils/rnw'
import { CardOnboardingVerificationScreen } from '@modules/card/screens/CardOnboardingVerificationScreen'
import { CardOnboardingStatusScreen } from '@modules/card/screens/CardOnboardingStatusScreen'
import { CardSignInScreen } from '@modules/card/screens/CardSignInScreen'
import { mockOauthChain } from '@perawallet/wallet-core-card/test-handlers'

const SESSION_URL = 'https://kyc.example/dev-session'

// KYC entry → setup-status checklist, with sign-in as the finalize fallback.
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
                { name: 'CardSignIn', component: CardSignInScreen },
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
                {
                    id: 'mock-onboarding-id',
                    verificationState,
                    email: 'john@example.com',
                    phase: 'MAILING_ADDRESS',
                },
                { status: 200 },
            ),
        ),
    )

describe('Flow: Card onboarding — identity verification', () => {
    beforeEach(async () => {
        // A verified login in an earlier test leaves a session behind.
        await clearCardSession()
        const store = useCardStore.getState()
        store.resetState()
        store.setOnboardingId('mock-onboarding-id')
        store.setCountryIso('GB')
        // The router writes this when the last form is submitted.
        store.setOnboardingStep(OnboardingStep.Verification)
        vi.spyOn(Linking, 'openURL').mockResolvedValue(true)
        vi.spyOn(Linking, 'canOpenURL').mockResolvedValue(true)
        // The sign-in fallback screen loads the registration settings.
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
        vi.restoreAllMocks()
    })

    it('Given the KYC entry, when Verify is pressed, then the hosted KYC session opens in the browser', async () => {
        mockStartVerification()

        renderFlow()
        fireEvent.click(screen.getByTestId('card-onboarding-verification-cta'))

        await waitFor(() =>
            expect(Linking.openURL).toHaveBeenCalledWith(SESSION_URL),
        )
    })

    it('Given KYC reports PENDING, then the setup status shows the pending documents row', async () => {
        mockStartVerification()
        mockOnboardingDetails('PENDING')

        renderFlow()
        fireEvent.click(screen.getByTestId('card-onboarding-verification-cta'))

        // The poll confirms KYC reported back, so the checklist appears with
        // the documents row pending while Baanx reviews.
        await waitFor(() =>
            expect(screen.getByTestId('card-onboarding-status')).toBeTruthy(),
        )
        expect(
            screen.getByTestId('card-onboarding-status-pending-label'),
        ).toBeTruthy()
    })

    it('Given the forms are in but KYC never completed (UNVERIFIED), then the row prompts to verify', async () => {
        // An abandoned KYC must not read as submitted ("Pending").
        mockOnboardingDetails('UNVERIFIED')

        renderStatus()

        await waitFor(() =>
            expect(
                screen.getByTestId('card-onboarding-status-documents-verify'),
            ).toBeTruthy(),
        )
        // Not shown as submitted, and the details step reads as done.
        expect(
            screen.queryByTestId('card-onboarding-status-pending-label'),
        ).toBeNull()
        expect(
            screen.queryByTestId('card-onboarding-status-details-cta'),
        ).toBeNull()
    })

    it('Given a form is still owed, then the documents row is locked and Enter Your Details opens the form', async () => {
        useCardStore.getState().setOnboardingStep(OnboardingStep.Address)
        server.use(
            http.get('*/v1/auth/register', () =>
                HttpResponse.json(
                    {
                        id: 'mock-onboarding-id',
                        verificationState: 'UNVERIFIED',
                        phase: 'PHYSICAL_ADDRESS',
                    },
                    { status: 200 },
                ),
            ),
        )

        renderStatus()

        expect(
            await screen.findByTestId('card-onboarding-status-details-cta'),
        ).toBeTruthy()
        expect(
            screen.queryByTestId('card-onboarding-status-documents-verify'),
        ).toBeNull()
    })

    it('Given KYC verifies, then the login with the password from email verification creates the session and Connect Funds unlocks', async () => {
        useCardStore.getState().setPassword('Correct-Horse-1234')
        let loginBody: Record<string, unknown> | undefined
        mockStartVerification()
        mockOnboardingDetails('VERIFIED')
        server.use(
            http.post('*/v1/auth/login', async ({ request }) => {
                loginBody = (await request.json()) as Record<string, unknown>
                return HttpResponse.json(
                    {
                        accessToken: 'login-token',
                        userId: 'user_1',
                        isOtpRequired: false,
                    },
                    { status: 200 },
                )
            }),
            ...mockOauthChain(),
            http.get('*/v1/user', () =>
                HttpResponse.json(
                    { id: 'user_1', verificationState: 'VERIFIED' },
                    { status: 200 },
                ),
            ),
        )

        renderFlow()
        fireEvent.click(screen.getByTestId('card-onboarding-verification-cta'))

        await waitFor(() =>
            expect(
                screen.getByTestId('card-onboarding-status-connect-cta'),
            ).toBeTruthy(),
        )
        expect(loginBody).toEqual({
            email: 'john@example.com',
            password: 'Correct-Horse-1234',
        })
        const state = useCardStore.getState()
        expect(state.onboardingStep).toBe(OnboardingStep.Completed)
        expect(state.cardUserId).toBe('user_1')
        expect(state.hasPassword).toBe(false)
    })

    it('Given the post-KYC login answers that the account is locked, then the checklist says so and never logs in again', async () => {
        useCardStore.getState().setPassword('Correct-Horse-1234')
        const loginSpy = vi.fn()
        mockStartVerification()
        mockOnboardingDetails('VERIFIED')
        server.use(
            http.post('*/v1/auth/login', () => {
                loginSpy()
                return HttpResponse.json(
                    { message: 'Account locked. Contact support@baanx.com' },
                    { status: 403 },
                )
            }),
        )

        renderFlow()
        fireEvent.click(screen.getByTestId('card-onboarding-verification-cta'))

        expect(
            await screen.findByText(
                'peraCard.setup_status.documents_account_locked_body',
            ),
        ).toBeTruthy()
        expect(
            screen.queryByTestId('card-onboarding-status-documents-try-again'),
        ).toBeNull()
        expect(loginSpy).toHaveBeenCalledTimes(1)
        expect(useCardStore.getState().hasPassword).toBe(false)
    })

    it('Given the post-KYC login finds the account not created yet, then the checklist says it is being set up and offers one retry per tap', async () => {
        useCardStore.getState().setPassword('Correct-Horse-1234')
        const loginSpy = vi.fn()
        mockStartVerification()
        mockOnboardingDetails('VERIFIED')
        server.use(
            http.post('*/v1/auth/login', () => {
                loginSpy()
                return HttpResponse.json(
                    {
                        accessToken: null,
                        userId: 'user_1',
                        isOtpRequired: false,
                        phase: 'MAILING_ADDRESS',
                    },
                    { status: 200 },
                )
            }),
        )

        renderFlow()
        fireEvent.click(screen.getByTestId('card-onboarding-verification-cta'))

        expect(
            await screen.findByText(
                'peraCard.setup_status.documents_preparing_body',
            ),
        ).toBeTruthy()
        // Inside the two-minute spacing the retry is offered but disabled.
        const tryAgain = await screen.findByTestId(
            'card-onboarding-status-documents-try-again',
        )
        expect(isElementDisabled(tryAgain)).toBe(true)
        fireEvent.click(tryAgain)
        expect(loginSpy).toHaveBeenCalledTimes(1)
    })

    it('Given KYC verifies but the password is gone, then sign-in opens with the email prefilled', async () => {
        mockStartVerification()
        mockOnboardingDetails('VERIFIED')
        const loginSpy = vi.fn()
        server.use(
            http.post('*/v1/auth/login', () => {
                loginSpy()
                return HttpResponse.json({}, { status: 400 })
            }),
        )

        renderFlow()
        fireEvent.click(screen.getByTestId('card-onboarding-verification-cta'))

        await waitFor(() =>
            expect(
                screen
                    .getByTestId('card-sign-in-email-input')
                    .getAttribute('value'),
            ).toBe('john@example.com'),
        )
        // Nothing to log in with, so no login is attempted.
        expect(loginSpy).not.toHaveBeenCalled()
        expect(useCardStore.getState().onboardingStep).not.toBe(
            OnboardingStep.Completed,
        )
    })

    describe('Given the onboarding record no longer resolves on a cold start', () => {
        const loginSpy = vi.fn<() => void>()
        beforeEach(() => {
            loginSpy.mockReset()
            server.use(
                http.get('*/v1/auth/register', () =>
                    HttpResponse.json(
                        { message: 'Invalid onboarding ID' },
                        { status: 404 },
                    ),
                ),
                http.post('*/v1/auth/login', () => {
                    loginSpy()
                    return HttpResponse.json({}, { status: 400 })
                }),
            )
        })

        const renderStatusWithSignIn = () =>
            renderWithNavigation(
                CardOnboardingStatusScreen,
                'CardOnboardingStatus',
                {
                    additionalScreens: [
                        { name: 'CardSignIn', component: CardSignInScreen },
                    ],
                },
            )

        it('when this device saw it verified, then sign-in opens to finish', async () => {
            useCardStore
                .getState()
                .setVerifiedOnboardingId('mock-onboarding-id')

            renderStatusWithSignIn()

            expect(
                await screen.findByTestId('card-sign-in-email-input'),
            ).toBeTruthy()
            expect(
                screen.queryByTestId('card-onboarding-status-documents-verify'),
            ).toBeNull()
            // The password didn't survive the restart, so there is nothing to log in with.
            expect(loginSpy).not.toHaveBeenCalled()
        })

        it('when this device never saw it verified, then the row offers a sign-in without claiming the identity is verified', async () => {
            renderStatusWithSignIn()

            expect(
                await screen.findByText(
                    'peraCard.setup_status.documents_record_missing_body',
                ),
            ).toBeTruthy()
            expect(screen.queryByTestId('card-sign-in-email-input')).toBeNull()
            expect(
                screen.queryByTestId('card-onboarding-status-documents-verify'),
            ).toBeNull()

            fireEvent.click(
                screen.getByTestId('card-onboarding-status-documents-sign-in'),
            )

            expect(
                await screen.findByTestId('card-sign-in-email-input'),
            ).toBeTruthy()
            expect(loginSpy).not.toHaveBeenCalled()
        })
    })

    it('Given registration is incomplete, then the Connect Funds row stays inactive', () => {
        mockOnboardingDetails('PENDING')

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

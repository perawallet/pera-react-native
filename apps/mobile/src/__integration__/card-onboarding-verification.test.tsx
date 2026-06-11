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
import { PeraCardIntroScreen } from '@modules/card/screens/PeraCardIntroScreen'

const SESSION_URL = 'https://veriff.example/dev-session'

// Land back on the intro screen once verification completes.
const renderFlow = () =>
    renderWithNavigation(
        CardOnboardingVerificationScreen,
        'CardOnboardingVerification',
        {
            additionalScreens: [
                { name: 'PeraCardIntro', component: PeraCardIntroScreen },
            ],
        },
    )

const mockVerificationSession = () =>
    server.use(
        http.get('*/v1/user/verification', () =>
            HttpResponse.json({ sessionUrl: SESSION_URL }, { status: 200 }),
        ),
    )

const mockUser = (verificationState: string) =>
    server.use(
        http.get('*/v1/user', () =>
            HttpResponse.json(
                { id: 'mock-user-id', verificationState },
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
    })
    afterEach(() => {
        server.resetHandlers()
        vi.restoreAllMocks()
    })
    afterAll(() => server.close())

    it('Given the verification screen, when Start is pressed, then the Veriff session URL opens', async () => {
        mockVerificationSession()

        renderFlow()
        fireEvent.click(screen.getByTestId('card-onboarding-verification-cta'))

        await waitFor(() =>
            expect(Linking.openURL).toHaveBeenCalledWith(SESSION_URL),
        )
    })

    it('Given verification becomes VERIFIED, then onboarding completes and returns to the intro', async () => {
        mockVerificationSession()
        mockUser('VERIFIED')

        renderFlow()
        fireEvent.click(screen.getByTestId('card-onboarding-verification-cta'))

        await waitFor(() =>
            expect(useCardStore.getState().onboardingStep).toBe(
                OnboardingStep.Completed,
            ),
        )
        await waitFor(() =>
            expect(
                screen.getByTestId('pera_card_intro_create_button'),
            ).toBeTruthy(),
        )
    })
})

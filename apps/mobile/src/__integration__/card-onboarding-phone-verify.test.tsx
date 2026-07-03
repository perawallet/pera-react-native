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
import { CardOnboardingPhoneVerifyScreen } from '@modules/card/screens/CardOnboardingPhoneVerifyScreen'
import { CardOnboardingVerificationScreen } from '@modules/card/screens/CardOnboardingVerificationScreen'
import { CardOnboardingPasswordScreen } from '@modules/card/screens/CardOnboardingPasswordScreen'

const VALID_CODE = '123456'

// The screen reads the flow's data from the store (no nav params), so seed it.
const renderVerify = () =>
    renderWithNavigation(
        CardOnboardingPhoneVerifyScreen,
        'CardOnboardingPhoneVerify',
        {
            additionalScreens: [
                {
                    name: 'CardOnboardingPassword',
                    component: CardOnboardingPasswordScreen,
                },
                {
                    name: 'CardOnboardingVerification',
                    component: CardOnboardingVerificationScreen,
                },
            ],
        },
    )

describe('card onboarding — phone verify', () => {
    beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }))
    beforeEach(() => {
        vi.mocked(Notifier.showNotification).mockClear()
        const store = useCardStore.getState()
        store.resetState()
        store.setPhone({ phoneCountryCode: '44', phoneNumber: '7400846282' })
        store.setContactVerificationId('mock-contact-id')
        // email/verify ran on the (preceding) password step, so the onboardingId
        // phone/verify needs is already set when the user reaches this screen.
        store.setOnboardingId('mock-onboarding-id')
    })
    afterEach(() => server.resetHandlers())
    afterAll(() => server.close())

    it('verifies the code (auto-submit) and advances to identity verification', async () => {
        const verifySpy = vi.fn(() => HttpResponse.json({}, { status: 200 }))
        server.use(http.post('*/v1/auth/register/phone/verify', verifySpy))

        renderVerify()

        // Entering the full valid code auto-submits — no button tap needed.
        fireEvent.change(
            screen.getByTestId('card-onboarding-phone-verify-input'),
            { target: { value: VALID_CODE } },
        )

        await waitFor(() => expect(verifySpy).toHaveBeenCalled())
        await waitFor(() =>
            expect(
                screen.getByTestId('card-onboarding-verification'),
            ).toBeTruthy(),
        )
    })

    it('surfaces an inline error when phone/verify rejects the code', async () => {
        server.use(
            http.post('*/v1/auth/register/phone/verify', () =>
                HttpResponse.json({ message: 'wrong code' }, { status: 400 }),
            ),
        )

        renderVerify()

        fireEvent.change(
            screen.getByTestId('card-onboarding-phone-verify-input'),
            { target: { value: VALID_CODE } },
        )

        // The rejected code is surfaced inline; the user stays on this screen.
        await waitFor(() =>
            expect(
                screen.getByTestId('card-onboarding-phone-verify-input-error'),
            ).toBeTruthy(),
        )
    })

    it('routes back to the password step when the onboarding id is missing', async () => {
        // Defensive: email/verify should have set it, but if it's somehow gone
        // phone/verify can't run — send the user back rather than POSTing blind.
        useCardStore.getState().setOnboardingId(null)
        const verifySpy = vi.fn(() => HttpResponse.json({}, { status: 200 }))
        server.use(http.post('*/v1/auth/register/phone/verify', verifySpy))

        renderVerify()

        fireEvent.change(
            screen.getByTestId('card-onboarding-phone-verify-input'),
            { target: { value: VALID_CODE } },
        )

        await waitFor(() =>
            expect(
                screen.getByTestId('card-onboarding-password-input'),
            ).toBeTruthy(),
        )
        expect(verifySpy).not.toHaveBeenCalled()
    })
})

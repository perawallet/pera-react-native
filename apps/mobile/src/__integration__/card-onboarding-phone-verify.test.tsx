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
    })
    afterEach(() => server.resetHandlers())
    afterAll(() => server.close())

    it('surfaces a wrong-code error on auto-submit and clears it when the code is edited', async () => {
        renderVerify()

        const input = screen.getByTestId('card-onboarding-phone-verify-input')

        // A full but wrong 6-digit code auto-submits; the local pre-check
        // surfaces the inline error without hitting the API.
        fireEvent.change(input, { target: { value: '654321' } })
        await waitFor(() =>
            expect(
                screen.queryByTestId(
                    'card-onboarding-phone-verify-input-error',
                ),
            ).toBeTruthy(),
        )

        // Editing to a shorter value clears the error (and doesn't re-submit).
        fireEvent.change(input, { target: { value: '65432' } })
        await waitFor(() =>
            expect(
                screen.queryByTestId(
                    'card-onboarding-phone-verify-input-error',
                ),
            ).toBeNull(),
        )
    })

    it('stashes the valid code (auto-submit) and advances to the password step', async () => {
        const verifySpy = vi.fn(() => HttpResponse.json({}, { status: 200 }))
        server.use(http.post('*/v1/auth/register/phone/verify', verifySpy))

        renderVerify()

        // Entering the full valid code auto-submits — no button tap needed.
        fireEvent.change(
            screen.getByTestId('card-onboarding-phone-verify-input'),
            { target: { value: VALID_CODE } },
        )

        // The real phone/verify is deferred to the password step (it needs the
        // onboardingId email/verify returns), so the code is stashed instead.
        await waitFor(() =>
            expect(
                screen.getByTestId('card-onboarding-password-input'),
            ).toBeTruthy(),
        )
        expect(verifySpy).not.toHaveBeenCalled()
        expect(useCardStore.getState().phoneVerificationCode).toBe(VALID_CODE)
    })

    it('verifies directly and advances to identity verification on the retry path', async () => {
        // After the password step the onboardingId exists; a re-entered code
        // (e.g. the deferred verify failed) fires the real call from here.
        useCardStore.getState().setOnboardingId('mock-onboarding-id')
        const verifySpy = vi.fn(() => HttpResponse.json({}, { status: 200 }))
        server.use(http.post('*/v1/auth/register/phone/verify', verifySpy))

        renderVerify()

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
})

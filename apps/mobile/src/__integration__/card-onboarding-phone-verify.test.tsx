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

const VALID_CODE = 'PERA123'

// The screen reads the flow's data from the store (no nav params), so seed it.
const renderVerify = () =>
    renderWithNavigation(
        CardOnboardingPhoneVerifyScreen,
        'CardOnboardingPhoneVerify',
    )

describe('card onboarding — phone verify', () => {
    beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }))
    beforeEach(() => {
        vi.mocked(Notifier.showNotification).mockClear()
        const store = useCardStore.getState()
        store.resetState()
        store.setPhone({ phoneCountryCode: '44', phoneNumber: '7400846282' })
        store.setOnboardingId('mock-onboarding-id')
        store.setContactVerificationId('mock-contact-id')
    })
    afterEach(() => server.resetHandlers())
    afterAll(() => server.close())

    it('surfaces a wrong-code error on submit and clears it when the code is edited', async () => {
        renderVerify()

        const input = screen.getByTestId('card-onboarding-phone-verify-input')

        fireEvent.change(input, { target: { value: 'WRONG1' } })
        fireEvent.click(
            screen.getByTestId('card-onboarding-phone-verify-confirm'),
        )
        await waitFor(() =>
            expect(input.getAttribute('errormessage')).toBeTruthy(),
        )

        fireEvent.change(input, { target: { value: 'WRONG12' } })
        await waitFor(() =>
            expect(input.getAttribute('errormessage')).toBeFalsy(),
        )
    })

    it('verifies the phone with the valid code and confirms success', async () => {
        const verifySpy = vi.fn(() => HttpResponse.json({}, { status: 200 }))
        server.use(http.post('*/v1/auth/register/phone/verify', verifySpy))

        renderVerify()

        fireEvent.change(
            screen.getByTestId('card-onboarding-phone-verify-input'),
            { target: { value: VALID_CODE } },
        )
        fireEvent.click(
            screen.getByTestId('card-onboarding-phone-verify-confirm'),
        )

        await waitFor(() => expect(verifySpy).toHaveBeenCalled())
        await waitFor(() =>
            expect(Notifier.showNotification).toHaveBeenCalled(),
        )
    })
})

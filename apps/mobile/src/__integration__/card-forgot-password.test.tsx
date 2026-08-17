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
import { Notifier } from 'react-native-notifier'

import {
    mockPasswordResetConfirm,
    mockPasswordResetRequest,
    mockPasswordResetVerify,
} from '@perawallet/wallet-core-card/test-handlers'

import { server } from '@test-utils/msw-server'
import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import { CardSignInScreen } from '@modules/card/screens/CardSignInScreen'
import { CardForgotPasswordScreen } from '@modules/card/screens/CardForgotPasswordScreen'
import { CardForgotPasswordVerifyScreen } from '@modules/card/screens/CardForgotPasswordVerifyScreen'
import { CardForgotPasswordNewPasswordScreen } from '@modules/card/screens/CardForgotPasswordNewPasswordScreen'

const EMAIL = 'john@example.com'
// Satisfies every PASSWORD_RULES entry (15+, upper, lower, digit, special).
const NEW_PASSWORD = 'Str0ng!Password#XY'

const renderFlow = () =>
    renderWithNavigation(CardSignInScreen, 'CardSignIn', {
        additionalScreens: [
            { name: 'CardForgotPassword', component: CardForgotPasswordScreen },
            {
                name: 'CardForgotPasswordVerify',
                component: CardForgotPasswordVerifyScreen,
            },
            {
                name: 'CardForgotPasswordNewPassword',
                component: CardForgotPasswordNewPasswordScreen,
            },
        ],
    })

// Types the email on the sign-in screen first, so the flow's prefill
// hand-off (sign-in -> reset -> back to sign-in) is exercised end to end.
const openForgotPassword = async () => {
    fireEvent.change(screen.getByTestId('card-sign-in-email-input'), {
        target: { value: EMAIL },
    })
    fireEvent.click(screen.getByTestId('card-sign-in-forgot-password'))
    return await screen.findByTestId('card-forgot-password-email-input')
}

describe('Flow: Card forgot password', () => {
    beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }))
    beforeEach(() => vi.mocked(Notifier.showNotification).mockClear())
    afterEach(() => server.resetHandlers())
    afterAll(() => server.close())

    it('Given a signed-out user, when they complete the reset flow, then they land back on sign-in with the email prefilled', async () => {
        server.use(
            mockPasswordResetRequest(),
            mockPasswordResetVerify({ response: { token: 'reset-token-1' } }),
            mockPasswordResetConfirm(),
        )

        renderFlow()
        const emailInput = await openForgotPassword()

        // Email step: prefilled from the sign-in form, submit enabled.
        expect((emailInput as HTMLInputElement).value).toBe(EMAIL)
        await waitFor(() =>
            expect(
                screen
                    .getByTestId('card-forgot-password-submit')
                    .getAttribute('disabled'),
            ).toBeNull(),
        )
        fireEvent.click(screen.getByTestId('card-forgot-password-submit'))

        // Code step: a complete code auto-submits and advances.
        const codeInput = await screen.findByTestId(
            'card-forgot-password-verify-input',
        )
        fireEvent.change(codeInput, { target: { value: '123456' } })

        // New password step.
        const passwordInput = await screen.findByTestId(
            'card-forgot-password-password-input',
        )
        fireEvent.change(passwordInput, { target: { value: NEW_PASSWORD } })
        fireEvent.change(
            screen.getByTestId('card-forgot-password-confirm-password-input'),
            { target: { value: NEW_PASSWORD } },
        )
        await waitFor(() =>
            expect(
                screen
                    .getByTestId('card-forgot-password-confirm')
                    .getAttribute('disabled'),
            ).toBeNull(),
        )
        fireEvent.click(screen.getByTestId('card-forgot-password-confirm'))

        // Back on sign-in: toast shown, email carried back into the form.
        await waitFor(() =>
            expect(screen.getByTestId('card-sign-in-email-input')).toBeTruthy(),
        )
        expect(Notifier.showNotification).toHaveBeenCalled()
        expect(
            (screen.getByTestId('card-sign-in-email-input') as HTMLInputElement)
                .value,
        ).toBe(EMAIL)
    })

    it('Given a wrong code, when it is submitted, then an inline error shows and the flow stays on the code screen', async () => {
        server.use(
            mockPasswordResetRequest(),
            http.post('*/v1/auth/password/reset/verify', () =>
                HttpResponse.json({ message: 'Invalid code' }, { status: 422 }),
            ),
        )

        renderFlow()
        await openForgotPassword()
        fireEvent.click(screen.getByTestId('card-forgot-password-submit'))

        const codeInput = await screen.findByTestId(
            'card-forgot-password-verify-input',
        )
        fireEvent.change(codeInput, { target: { value: '000000' } })

        // The harness's i18next instance is uninitialized (see
        // `NO_I18NEXT_INSTANCE` warnings elsewhere in this suite), so `t()`
        // returns the raw key rather than the translated English copy.
        await screen.findByText('peraCard.forgot_password.code_invalid')
        // Still on the code screen; never advanced to the password step.
        expect(
            screen.queryByTestId('card-forgot-password-password-input'),
        ).toBeNull()
    })
})

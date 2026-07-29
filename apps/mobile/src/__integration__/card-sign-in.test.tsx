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
import { View } from 'react-native'
import { Notifier } from 'react-native-notifier'

import { mockOauthChain } from '@perawallet/wallet-core-card/test-handlers'

import { server } from '@test-utils/msw-server'
import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import { CardSignInScreen } from '@modules/card/screens/CardSignInScreen'

const VALID_EMAIL = 'john@example.com'
const VALID_PASSWORD = 'Passw0rd!'

// Stand-ins for the post-login destinations, which live in nested navigators
// outside this flat test stack. The PeraCard stub reflects the nested target
// screen in its testID so tests can tell KYC-entry from the checklist.
const HomeStub = () => <View testID='home-tab-stub' />
type PeraCardStubProps = {
    route: { params?: { params?: { screen?: string } } }
}
const PeraCardStub = ({ route }: PeraCardStubProps) => (
    <View
        testID={`peracard-dest-${route.params?.params?.screen ?? 'unknown'}`}
    />
)

const renderSignIn = () =>
    renderWithNavigation(CardSignInScreen, 'CardSignIn', {
        additionalScreens: [
            { name: 'TabBar', component: HomeStub },
            { name: 'PeraCard', component: PeraCardStub },
        ],
    })

// The post-login OAuth code+PKCE chain (initiate → authorize with echoed
// CSRF state → token exchange) is stubbed by the package's mockOauthChain.
const stubOauthChain = () => server.use(...mockOauthChain())

// Enter a valid email + password and wait for the Sign In button to enable.
const fillCredentials = async () => {
    fireEvent.change(screen.getByTestId('card-sign-in-email-input'), {
        target: { value: VALID_EMAIL },
    })
    fireEvent.change(screen.getByTestId('card-sign-in-password-input'), {
        target: { value: VALID_PASSWORD },
    })
    await waitFor(() =>
        expect(
            screen.getByTestId('card-sign-in-submit').getAttribute('disabled'),
        ).toBeNull(),
    )
}

describe('Flow: Card sign in', () => {
    beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }))
    beforeEach(() => vi.mocked(Notifier.showNotification).mockClear())
    afterEach(() => server.resetHandlers())
    afterAll(() => server.close())

    it('Given valid credentials and a ready account, when Sign In is pressed, then the OAuth exchange runs and the wallet home opens', async () => {
        const loginSpy = vi.fn(() =>
            HttpResponse.json(
                {
                    accessToken: 'access-token',
                    userId: 'user-1',
                    isOtpRequired: false,
                    phase: null,
                    isLinked: true,
                },
                { status: 200 },
            ),
        )
        server.use(http.post('*/v1/auth/login', loginSpy))
        stubOauthChain()

        renderSignIn()
        await fillCredentials()
        fireEvent.click(screen.getByTestId('card-sign-in-submit'))

        await waitFor(() => expect(loginSpy).toHaveBeenCalled())
        await waitFor(() =>
            expect(screen.getByTestId('home-tab-stub')).toBeTruthy(),
        )
        expect(Notifier.showNotification).toHaveBeenCalled()
    })

    it('Given the OAuth exchange fails after a valid login, when Sign In is pressed, then a fallback session is created and the wallet home still opens', async () => {
        // Credentials were accepted, so an OAuth-proxy outage must degrade to
        // the refresh-less 6h session (pre-OAuth behavior), not fail login.
        server.use(
            http.post('*/v1/auth/login', () =>
                HttpResponse.json(
                    {
                        accessToken: 'access-token',
                        userId: 'user-1',
                        isOtpRequired: false,
                        phase: null,
                        isLinked: true,
                    },
                    { status: 200 },
                ),
            ),
            // Initiate rejects — the chain never reaches the token exchange.
            http.get('*/baanx/oauth/initiate', () =>
                HttpResponse.json(
                    { message: 'not configured' },
                    { status: 500 },
                ),
            ),
        )

        renderSignIn()
        await fillCredentials()
        fireEvent.click(screen.getByTestId('card-sign-in-submit'))

        await waitFor(() =>
            expect(screen.getByTestId('home-tab-stub')).toBeTruthy(),
        )
    })

    it('Given a mid-registration login for an unverified user, when Sign In is pressed, then the KYC entry screen opens', async () => {
        // A mid-onboarding login returns a `phase` but no accessToken and a null
        // verificationState; the app reads the real KYC state from the pre-auth
        // onboarding endpoint, using the login userId as the onboardingId.
        let onboardingQueryId: string | null = null
        server.use(
            http.post('*/v1/auth/login', () =>
                HttpResponse.json(
                    {
                        accessToken: null,
                        userId: 'user-123',
                        isOtpRequired: false,
                        phase: 'PERSONAL_INFORMATION',
                        verificationState: null,
                    },
                    { status: 200 },
                ),
            ),
            http.get('*/v1/auth/register', ({ request }) => {
                onboardingQueryId = new URL(request.url).searchParams.get(
                    'onboardingId',
                )
                return HttpResponse.json(
                    { verificationState: 'UNVERIFIED' },
                    { status: 200 },
                )
            }),
        )

        renderSignIn()
        await fillCredentials()
        fireEvent.click(screen.getByTestId('card-sign-in-submit'))

        await waitFor(() =>
            expect(
                screen.getByTestId('peracard-dest-CardOnboardingVerification'),
            ).toBeTruthy(),
        )
        // The login userId was used as the onboardingId for the KYC lookup.
        expect(onboardingQueryId).toBe('user-123')
        expect(screen.queryByTestId('home-tab-stub')).toBeNull()
    })

    it('Given a verified user whose server phase awaits the address, when Sign In is pressed, then the address form opens', async () => {
        server.use(
            http.post('*/v1/auth/login', () =>
                HttpResponse.json(
                    {
                        accessToken: null,
                        userId: 'user-123',
                        isOtpRequired: false,
                        phase: 'PHYSICAL_ADDRESS',
                        verificationState: null,
                    },
                    { status: 200 },
                ),
            ),
            http.get('*/v1/auth/register', () =>
                HttpResponse.json(
                    { verificationState: 'VERIFIED' },
                    { status: 200 },
                ),
            ),
        )

        renderSignIn()
        await fillCredentials()
        fireEvent.click(screen.getByTestId('card-sign-in-submit'))

        // Resume routes to the step the server is waiting for, not a generic
        // checklist — the phase says the physical address is still missing.
        await waitFor(() =>
            expect(
                screen.getByTestId('peracard-dest-CardOnboardingAddress'),
            ).toBeTruthy(),
        )
    })

    it('Given a rejected user, when Sign In is pressed, then the setup checklist opens with the rejection', async () => {
        server.use(
            http.post('*/v1/auth/login', () =>
                HttpResponse.json(
                    {
                        accessToken: null,
                        userId: 'user-123',
                        isOtpRequired: false,
                        phase: 'PHYSICAL_ADDRESS',
                        verificationState: 'REJECTED',
                    },
                    { status: 200 },
                ),
            ),
        )

        renderSignIn()
        await fillCredentials()
        fireEvent.click(screen.getByTestId('card-sign-in-submit'))

        // A rejected user can't complete the remaining forms; the checklist
        // shows the rejected documents row and the support link.
        await waitFor(() =>
            expect(
                screen.getByTestId('peracard-dest-CardOnboardingStatus'),
            ).toBeTruthy(),
        )
    })

    it('Given the account requires a 2FA code, when Sign In is pressed, then the code is sent, the input appears, and a valid code completes sign-in', async () => {
        let calls = 0
        let otpRequestUserId: string | null = null
        server.use(
            http.post('*/v1/auth/login', () => {
                calls += 1
                // First attempt: credentials accepted but a code is required.
                if (calls === 1) {
                    return HttpResponse.json(
                        {
                            accessToken: null,
                            userId: 'user-2fa',
                            isOtpRequired: true,
                        },
                        { status: 200 },
                    )
                }
                // Second attempt (with the code): a ready session.
                return HttpResponse.json(
                    { accessToken: 'access-token', phase: null },
                    { status: 200 },
                )
            }),
            // Baanx does not send the code on its own — the app must request
            // it through the OTP endpoint, keyed on the login userId.
            http.post('*/v1/auth/login/otp', async ({ request }) => {
                const body = (await request.json()) as { userId?: string }
                otpRequestUserId = body.userId ?? null
                return HttpResponse.json({ success: true }, { status: 200 })
            }),
        )
        stubOauthChain()

        renderSignIn()
        await fillCredentials()
        fireEvent.click(screen.getByTestId('card-sign-in-submit'))

        // A full code auto-submits via the input's onComplete.
        const otp = await screen.findByTestId('card-sign-in-otp-input')
        // The 2FA code was requested for the right user before entry.
        await waitFor(() => expect(otpRequestUserId).toBe('user-2fa'))
        fireEvent.change(otp, { target: { value: '123456' } })

        await waitFor(() => expect(calls).toBe(2))
        await waitFor(() =>
            expect(screen.getByTestId('home-tab-stub')).toBeTruthy(),
        )
    })

    it('Given a real access token alongside a stale phase, when Sign In is pressed, then the token wins and the wallet home opens', async () => {
        // A completed account whose response still carries a (stale) phase must
        // be honored by its access token and land on Home, not be sent back into
        // the onboarding stack.
        server.use(
            http.post('*/v1/auth/login', () =>
                HttpResponse.json(
                    {
                        accessToken: 'access-token',
                        userId: 'user-1',
                        isOtpRequired: false,
                        phase: 'PHYSICAL_ADDRESS',
                        verificationState: 'VERIFIED',
                    },
                    { status: 200 },
                ),
            ),
        )
        stubOauthChain()

        renderSignIn()
        await fillCredentials()
        fireEvent.click(screen.getByTestId('card-sign-in-submit'))

        await waitFor(() =>
            expect(screen.getByTestId('home-tab-stub')).toBeTruthy(),
        )
        expect(
            screen.queryByTestId('peracard-dest-CardOnboardingStatus'),
        ).toBeNull()
    })

    it('Given wrong credentials, when Sign In is pressed, then an inline error shows on the password field and the flow stays put', async () => {
        server.use(
            http.post('*/v1/auth/login', () =>
                HttpResponse.json({ message: 'bad creds' }, { status: 401 }),
            ),
        )

        renderSignIn()
        await fillCredentials()
        fireEvent.click(screen.getByTestId('card-sign-in-submit'))

        const password = screen.getByTestId('card-sign-in-password-input')
        await waitFor(() =>
            expect(password.getAttribute('errormessage')).toBe(
                'peraCard.sign_in.invalid_credentials',
            ),
        )
        expect(screen.queryByTestId('home-tab-stub')).toBeNull()
    })

    it('shows a coming-soon toast when Forgot Password is tapped', async () => {
        renderSignIn()

        fireEvent.click(screen.getByTestId('card-sign-in-forgot-password'))

        await waitFor(() =>
            expect(Notifier.showNotification).toHaveBeenCalled(),
        )
    })
})

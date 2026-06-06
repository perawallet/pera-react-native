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
} from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'

import { server } from '@test-utils/msw-server'
import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import { resetTestKeystore } from '@test-utils/algorand-keystore-test'
import { OnboardingScreen } from '@modules/onboarding/screens/OnboardingScreen/OnboardingScreen'
import { NameAccountScreen } from '@modules/onboarding/screens/NameAccountScreen/NameAccountScreen'
import { useAccountsStore } from '@perawallet/wallet-core-accounts'
import { useOnboardingStore } from '@modules/onboarding/hooks/useOnboardingStore'

// Flow under test: the user lands on the Onboarding screen, taps "Create
// wallet", picks a name, taps "Finish". The whole chain runs end-to-end —
// real `useCreateAccount` → real `useKMS` → in-memory keystore + accounts
// store. No HTTP calls are needed for the create path; MSW is started with
// `onUnhandledRequest: 'warn'` to surface anything unexpected.

describe('Flow: Onboarding → Create wallet', () => {
    beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }))
    afterEach(() => server.resetHandlers())
    afterAll(() => server.close())

    beforeEach(() => {
        // Each test starts from a clean wallet — empty keystore + empty
        // accounts store + onboarding flag reset.
        resetTestKeystore()
        useAccountsStore.getState().setAccounts([])
        useOnboardingStore.getState().reset()
    })

    // Per-test timeout: real BIP39 + xhd-wallet-api derivation runs end to
    // end, which under jsdom can take several seconds. Give the slow tests
    // headroom rather than mock the crypto.
    const SLOW_TEST_TIMEOUT_MS = 30_000

    it(
        'Given the user taps "Create wallet" and finishes naming, then a single HD wallet account is persisted and onboarding completes',
        async () => {
            renderWithNavigation(OnboardingScreen, 'Onboarding', {
                additionalScreens: [
                    { name: 'NameAccount', component: NameAccountScreen },
                ],
            })

            await waitFor(() =>
                screen.getByTestId('onboarding_create_wallet_button'),
            )

            fireEvent.click(
                screen.getByTestId('onboarding_create_wallet_button'),
            )

            // The create handler defers to the next tick, derives a real BIP39
            // seed + HD root key, then pushes NameAccount. The crypto work can
            // take a couple of seconds the first time, so use a generous timeout.
            await waitFor(
                () => {
                    expect(
                        screen.getByTestId('name_account_finish_button'),
                    ).toBeTruthy()
                },
                { timeout: 10_000 },
            )

            // Finish: name is left as the default ("Wallet 1"), this exercises
            // the no-rename happy path.
            fireEvent.click(screen.getByTestId('name_account_finish_button'))

            // exitAccountFlow flips isOnboarding back to false in initial-
            // onboarding mode (true → false).
            await waitFor(
                () => {
                    expect(useOnboardingStore.getState().isOnboarding).toBe(
                        false,
                    )
                },
                { timeout: 10_000 },
            )

            const accounts = useAccountsStore.getState().accounts
            expect(accounts).toHaveLength(1)
            expect(useAccountsStore.getState().selectedAccountAddress).toBe(
                accounts[0].address,
            )
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given the user changes the wallet name, then the persisted account uses that name',
        async () => {
            renderWithNavigation(OnboardingScreen, 'Onboarding', {
                additionalScreens: [
                    { name: 'NameAccount', component: NameAccountScreen },
                ],
            })

            fireEvent.click(
                screen.getByTestId('onboarding_create_wallet_button'),
            )

            await waitFor(() => screen.getByTestId('name_account_name_input'), {
                timeout: 10_000,
            })

            fireEvent.change(screen.getByTestId('name_account_name_input'), {
                target: { value: 'My Trading Wallet' },
            })

            fireEvent.click(screen.getByTestId('name_account_finish_button'))

            await waitFor(
                () => {
                    expect(useOnboardingStore.getState().isOnboarding).toBe(
                        false,
                    )
                },
                { timeout: 10_000 },
            )

            expect(useAccountsStore.getState().accounts[0].name).toBe(
                'My Trading Wallet',
            )
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given the create button is tapped, when the work is in flight, then the loading overlay is rendered',
        async () => {
            renderWithNavigation(OnboardingScreen, 'Onboarding', {
                additionalScreens: [
                    { name: 'NameAccount', component: NameAccountScreen },
                ],
            })

            fireEvent.click(
                screen.getByTestId('onboarding_create_wallet_button'),
            )

            // The overlay mock renders a div with testid PWLoadingOverlay
            // whenever `isVisible` is true (see vitest.setup.ts). The async work
            // takes long enough that the overlay is observable before navigation
            // takes us off OnboardingScreen.
            await waitFor(() => {
                expect(screen.getByTestId('PWLoadingOverlay')).toBeTruthy()
            })

            // After the work completes, navigation transitions to NameAccount —
            // the overlay is unmounted with the OnboardingScreen.
            await waitFor(
                () => {
                    expect(
                        screen.getByTestId('name_account_finish_button'),
                    ).toBeTruthy()
                },
                { timeout: 10_000 },
            )
        },
        SLOW_TEST_TIMEOUT_MS,
    )
})

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
import { Notifier } from 'react-native-notifier'

import { server } from '@test-utils/msw-server'
import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import { resetTestKeystore } from '@test-utils/algorand-keystore-test'
import { WatchInfoScreen } from '@modules/onboarding/screens/WatchInfoScreen/WatchInfoScreen'
import { WatchAccountScreen } from '@modules/onboarding/screens/WatchAccountScreen/WatchAccountScreen'
import { NameAccountScreen } from '@modules/onboarding/screens/NameAccountScreen/NameAccountScreen'
import {
    AccountTypes,
    useAccountsStore,
} from '@perawallet/wallet-core-accounts'
import { useRemoteConfigStore } from '@perawallet/wallet-core-remote-config'
import { useOnboardingStore } from '@modules/onboarding/hooks/useOnboardingStore'

import { QUANTUM_TEST_ADDRESS } from './__fixtures__/quantum'

// A quantum-derived address is a standard 58-char Algorand address (Falcon
// derivation, not ed25519) — the watch flow is address-based and has no
// quantum-specific branch. Using this fixture as the watch target proves
// quantum addresses are watchable (FR-6): the resulting account must
// persist as AccountTypes.watch, NOT quantum.
const WATCH_TARGET_ADDRESS = QUANTUM_TEST_ADDRESS

// Per-test timeout: navigation transitions + a render frame inside
// NameAccount's handleFinish push the wall-clock past the 5s default.
const SLOW_TEST_TIMEOUT_MS = 30_000

describe('watch quantum address', () => {
    beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }))
    afterEach(() => {
        server.resetHandlers()
        useRemoteConfigStore.getState().resetState()
    })
    afterAll(() => server.close())

    beforeEach(() => {
        resetTestKeystore()
        useAccountsStore.getState().setAccounts([])
        useOnboardingStore.getState().reset()
        vi.mocked(Notifier.showNotification).mockClear()
    })

    it(
        'Given the watch info screen, when the user enters the quantum-derived address and finishes naming, then it persists as a watch account (not quantum)',
        async () => {
            renderWithNavigation(WatchInfoScreen, 'WatchInfo', {
                additionalScreens: [
                    { name: 'WatchAccount', component: WatchAccountScreen },
                    { name: 'NameAccount', component: NameAccountScreen },
                ],
            })

            // Info screen renders one PWButton (the "Continue" CTA), keyed
            // under the default 'PWButton' testid because the production
            // source doesn't pass an explicit one.
            await waitFor(() => screen.getByTestId('PWButton'))
            fireEvent.click(screen.getByTestId('PWButton'))

            // WatchAccountScreen renders the address input.
            await waitFor(() =>
                screen.getByTestId('watch_account_address_input'),
            )
            fireEvent.change(
                screen.getByTestId('watch_account_address_input'),
                { target: { value: WATCH_TARGET_ADDRESS } },
            )

            // Once the address is valid (and not duplicate), the submit
            // button enables.
            await waitFor(() => {
                expect(
                    (
                        screen.getByTestId(
                            'watch_account_submit_button',
                        ) as HTMLButtonElement
                    ).disabled,
                ).toBe(false)
            })
            fireEvent.click(screen.getByTestId('watch_account_submit_button'))

            // Watch flow inserts the new account immediately and navigates
            // to NameAccount. Default name is auto-numbered (#1).
            await waitFor(() =>
                screen.getByTestId('name_account_finish_button'),
            )
            await waitFor(() => {
                expect(useAccountsStore.getState().accounts).toHaveLength(1)
            })
            // The quantum-derived address has no quantum-specific branch in
            // the watch flow — it persists as a plain watch account.
            expect(useAccountsStore.getState().accounts[0].type).toBe(
                AccountTypes.watch,
            )
            expect(useAccountsStore.getState().accounts[0].address).toBe(
                WATCH_TARGET_ADDRESS,
            )

            // Override the default name and finish.
            fireEvent.change(screen.getByTestId('name_account_name_input'), {
                target: { value: 'Quantum watch' },
            })
            fireEvent.click(screen.getByTestId('name_account_finish_button'))

            await waitFor(() => {
                expect(useAccountsStore.getState().accounts[0].name).toBe(
                    'Quantum watch',
                )
            })
            expect(
                useAccountsStore
                    .getState()
                    .accounts.find(
                        account => account.address === WATCH_TARGET_ADDRESS,
                    )?.type,
            ).toBe(AccountTypes.watch)
            expect(useAccountsStore.getState().selectedAccountAddress).toBe(
                WATCH_TARGET_ADDRESS,
            )
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given a watch account with the quantum-derived address already exists, when the user enters that address, then the submit button stays disabled',
        async () => {
            // Pre-seed the store with the address the user is about to
            // type in. The watch flow shows the duplicate error inline and
            // disables submit — see useWatchAccountScreen.
            useAccountsStore.getState().setAccounts([
                {
                    id: 'existing-1',
                    type: AccountTypes.watch,
                    address: WATCH_TARGET_ADDRESS,
                },
            ])

            renderWithNavigation(WatchInfoScreen, 'WatchInfo', {
                additionalScreens: [
                    { name: 'WatchAccount', component: WatchAccountScreen },
                    { name: 'NameAccount', component: NameAccountScreen },
                ],
            })

            await waitFor(() => screen.getByTestId('PWButton'))
            fireEvent.click(screen.getByTestId('PWButton'))

            await waitFor(() =>
                screen.getByTestId('watch_account_address_input'),
            )
            fireEvent.change(
                screen.getByTestId('watch_account_address_input'),
                { target: { value: WATCH_TARGET_ADDRESS } },
            )

            // The button never enables: the duplicate guard short-circuits
            // both the validity check and the submit handler.
            expect(
                (
                    screen.getByTestId(
                        'watch_account_submit_button',
                    ) as HTMLButtonElement
                ).disabled,
            ).toBe(true)

            // Even if we somehow click it, the handler returns early —
            // assert no second account was added.
            fireEvent.click(screen.getByTestId('watch_account_submit_button'))
            expect(useAccountsStore.getState().accounts).toHaveLength(1)
        },
        SLOW_TEST_TIMEOUT_MS,
    )
})

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

// End-to-end proof that, with the quantum-accounts flag ON, a user can CREATE a
// brand-new Quantum account from the Add Account screen. Unlike the import flow,
// create runs a fresh mock-Falcon keygen (buildQuantumWalletAccount), so the
// derived address is non-deterministic — we assert on the persisted account
// *type* (AccountTypes.quantum), not a pinned address.

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

import {
    AccountTypes,
    useAccountsStore,
} from '@perawallet/wallet-core-accounts'
import { useRemoteConfigStore } from '@perawallet/wallet-core-remote-config'
import { server } from '@test-utils/msw-server'
import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import { resetTestKeystore } from '@test-utils/algorand-keystore-test'
import { AddAccountScreen } from '@modules/onboarding/screens/AddAccountScreen/AddAccountScreen'
import { NameAccountScreen } from '@modules/onboarding/screens/NameAccountScreen/NameAccountScreen'
import { useOnboardingStore } from '@modules/onboarding/hooks/useOnboardingStore'

const QUANTUM_FLAG = 'enable_quantum_accounts'

// Real mock-Falcon keygen plus a screen transition and a save round-trip — bump
// above the 5s default (mirrors onboarding-import-algo25.test.tsx).
const SLOW_TEST_TIMEOUT_MS = 30_000

/**
 * Turn the quantum-accounts flag on via the real remote-config override. The
 * store persists, so its async rehydration can otherwise land after the value
 * is set and wipe it — await hydration first so the override sticks for the
 * render under test.
 */
const enableQuantumFlag = async (): Promise<void> => {
    await useRemoteConfigStore.persist.rehydrate()
    useRemoteConfigStore.getState().setConfigOverride(QUANTUM_FLAG, true)
}

const renderAddAccount = () =>
    renderWithNavigation(AddAccountScreen, 'AddAccountHome', {
        additionalScreens: [
            { name: 'NameAccount', component: NameAccountScreen },
        ],
    })

describe('create quantum account', () => {
    beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }))
    afterEach(() => {
        server.resetHandlers()
        // Feature-flag override must not leak into other tests/files.
        useRemoteConfigStore.getState().resetState()
    })
    afterAll(() => server.close())

    beforeEach(() => {
        resetTestKeystore()
        useAccountsStore.getState().setAccounts([])
        useOnboardingStore.getState().reset()
    })

    it(
        'Given the flag is on, when the user creates a Quantum account and names it, then a quantum account is persisted',
        async () => {
            await enableQuantumFlag()

            renderAddAccount()

            // The Quantum create option is gated on the flag — with it on the
            // entrypoint must be visible.
            const createButton = await waitFor(() =>
                screen.getByTestId('add_account_create_quantum_button'),
            )

            fireEvent.click(createButton)

            // runCreateAccount opens the loading overlay, runs the real keygen,
            // then pushes NameAccount. The finish button appearing proves the
            // create step completed and the flow advanced.
            const finishButton = await waitFor(
                () => screen.getByTestId('name_account_finish_button'),
                { timeout: SLOW_TEST_TIMEOUT_MS },
            )

            fireEvent.click(finishButton)

            // handleFinish persists the built account via saveAccount. The
            // fresh keygen yields a non-deterministic address, so assert on the
            // account type rather than a pinned address.
            await waitFor(
                () => {
                    expect(
                        useAccountsStore
                            .getState()
                            .accounts.some(
                                a => a.type === AccountTypes.quantum,
                            ),
                    ).toBe(true)
                },
                { timeout: SLOW_TEST_TIMEOUT_MS },
            )
        },
        SLOW_TEST_TIMEOUT_MS,
    )
})

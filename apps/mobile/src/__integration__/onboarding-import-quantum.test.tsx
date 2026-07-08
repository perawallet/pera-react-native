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

import { server } from '@test-utils/msw-server'
import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import { resetTestKeystore } from '@test-utils/algorand-keystore-test'
import { OnboardingScreen } from '@modules/onboarding/screens/OnboardingScreen/OnboardingScreen'
import { ImportAccountOptionsScreen } from '@modules/onboarding/screens/ImportAccountOptionsScreen/ImportAccountOptionsScreen'
import { ImportAccountScreen } from '@modules/onboarding/screens/ImportAccountScreen/ImportAccountScreen'
import { SearchAccountsScreen } from '@modules/onboarding/screens/SearchAccountsScreen/SearchAccountsScreen'
import { ImportRekeyedAddressesScreen } from '@modules/onboarding/screens/ImportRekeyedAddressesScreen/ImportRekeyedAddressesScreen'
import { NameAccountScreen } from '@modules/onboarding/screens/NameAccountScreen/NameAccountScreen'
import {
    AccountTypes,
    useAccountsStore,
} from '@perawallet/wallet-core-accounts'
import { useOnboardingStore } from '@modules/onboarding/hooks/useOnboardingStore'
import { mockIndexerSearchForAccounts } from '@perawallet/wallet-core-blockchain/test-handlers'

import { ALGO25_TEST_MNEMONIC_WORDS } from './__fixtures__/onboarding'

// The quantum import option is feature-flag gated. Flag resolution itself is
// unit-tested (useIsQuantumAccountsEnabled + useImportAccountOptionsScreen);
// here we force it on so the flow test deterministically exercises the
// quantum entrypoint regardless of the test env's remote-config fallback.
vi.mock('@hooks/useIsQuantumAccountsEnabled', () => ({
    useIsQuantumAccountsEnabled: () => true,
}))

const typeWordsIndividually = (words: string[]) => {
    words.forEach((word, idx) => {
        fireEvent.change(
            screen.getByTestId(`import_account_word_input_${idx}`),
            { target: { value: word } },
        )
    })
}

const renderQuantumImportFromOnboarding = () =>
    renderWithNavigation(OnboardingScreen, 'Onboarding', {
        additionalScreens: [
            {
                name: 'ImportAccountOptions',
                component: ImportAccountOptionsScreen,
            },
            { name: 'ImportAccount', component: ImportAccountScreen },
            { name: 'SearchAccounts', component: SearchAccountsScreen },
            {
                name: 'ImportRekeyedAddresses',
                component: ImportRekeyedAddressesScreen,
            },
            { name: 'NameAccount', component: NameAccountScreen },
        ],
    })

// Quantum import is an explicit, dedicated entrypoint: unlike "Recover a
// wallet" it does not open the type-selection sheet or the ImportInfo screen —
// it navigates straight to the 25-word mnemonic screen with type 'quantum'.
const openQuantumImportScreen = async () => {
    fireEvent.click(screen.getByTestId('onboarding_import_account_button'))
    await waitFor(() => screen.getByTestId('import_account_quantum_button'))
    fireEvent.click(screen.getByTestId('import_account_quantum_button'))
    await waitFor(() => screen.getByTestId('import_account_word_input_24'))
}

// Real quantum key derivation (Falcon mock + keystore) plus several screen
// transitions and an indexer round trip — bump above the 5s default.
const SLOW_TEST_TIMEOUT_MS = 30_000

describe('Flow: Onboarding → Import Quantum (25-word)', () => {
    beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }))
    afterEach(() => server.resetHandlers())
    afterAll(() => server.close())

    beforeEach(() => {
        resetTestKeystore()
        useAccountsStore.getState().setAccounts([])
        useOnboardingStore.getState().reset()

        // No rekeyed accounts on-chain → SearchAccounts must route the quantum
        // account on to NameAccount (the fix for the hang) rather than stalling
        // on the "Searching your accounts" step.
        server.use(mockIndexerSearchForAccounts())
    })

    it(
        'Given a valid 25-word mnemonic, when the user imports through the Quantum entrypoint, then the explainer note renders, a quantum account is persisted, and onboarding completes without hanging on the search step',
        async () => {
            renderQuantumImportFromOnboarding()

            await openQuantumImportScreen()

            // The collision-guard explainer must actually render on the screen
            // (a 25-word regular Algorand phrase is not a Quantum account).
            expect(
                screen.getByTestId('import_account_quantum_note'),
            ).toBeTruthy()

            typeWordsIndividually(ALGO25_TEST_MNEMONIC_WORDS)

            await waitFor(() => {
                expect(
                    (
                        screen.getByTestId(
                            'import_account_import_button',
                        ) as HTMLButtonElement
                    ).disabled,
                ).toBe(false)
            })

            fireEvent.click(screen.getByTestId('import_account_import_button'))

            // Quantum import (like algo25) persists the account immediately,
            // then SearchAccounts scans for rekeyed accounts and — finding none
            // — advances to NameAccount. Before the fix, the quantum account
            // matched no branch and this screen never appeared.
            await waitFor(
                () => screen.getByTestId('name_account_finish_button'),
                { timeout: SLOW_TEST_TIMEOUT_MS },
            )
            fireEvent.click(screen.getByTestId('name_account_finish_button'))

            await waitFor(
                () => {
                    expect(useOnboardingStore.getState().isOnboarding).toBe(
                        false,
                    )
                },
                { timeout: 5000 },
            )

            const accounts = useAccountsStore.getState().accounts
            expect(accounts).toHaveLength(1)
            expect(accounts[0].type).toBe(AccountTypes.quantum)
            expect(useAccountsStore.getState().selectedAccountAddress).toBe(
                accounts[0].address,
            )
        },
        SLOW_TEST_TIMEOUT_MS,
    )
})

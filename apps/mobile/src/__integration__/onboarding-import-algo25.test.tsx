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
import { OnboardingScreen } from '@modules/onboarding/screens/OnboardingScreen/OnboardingScreen'
import { ImportAccountOptionsScreen } from '@modules/onboarding/screens/ImportAccountOptionsScreen/ImportAccountOptionsScreen'
import { ImportInfoScreen } from '@modules/onboarding/screens/ImportInfoScreen/ImportInfoScreen'
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

import {
    ALGO25_TEST_ADDRESS,
    ALGO25_TEST_MNEMONIC_WORDS,
    INVALID_ALGO25_MNEMONIC_WORDS,
    REKEY_TARGET_ADDRESS,
} from './__fixtures__/onboarding'

const typeWordsIndividually = (words: string[]) => {
    words.forEach((word, idx) => {
        fireEvent.change(
            screen.getByTestId(`import_account_word_input_${idx}`),
            { target: { value: word } },
        )
    })
}

const advanceThroughImportInfo = async () => {
    await waitFor(() => screen.getByTestId('import_info_recover_button'))
    fireEvent.click(screen.getByTestId('import_info_recover_button'))
}

const renderAlgo25ImportFromOnboarding = () =>
    renderWithNavigation(OnboardingScreen, 'Onboarding', {
        additionalScreens: [
            {
                name: 'ImportAccountOptions',
                component: ImportAccountOptionsScreen,
            },
            { name: 'ImportInfo', component: ImportInfoScreen },
            { name: 'ImportAccount', component: ImportAccountScreen },
            { name: 'SearchAccounts', component: SearchAccountsScreen },
            {
                name: 'ImportRekeyedAddresses',
                component: ImportRekeyedAddressesScreen,
            },
            { name: 'NameAccount', component: NameAccountScreen },
        ],
    })

// Drives the user from the Onboarding screen into the import-options bottom
// sheet. The intermediate ImportAccountOptions screen was introduced in
// — tapping "Import account" no longer opens the sheet directly.
const openImportOptionsSheet = async () => {
    fireEvent.click(screen.getByTestId('onboarding_import_account_button'))
    await waitFor(() =>
        screen.getByTestId('import_account_options_recover_wallet_button'),
    )
    fireEvent.click(
        screen.getByTestId('import_account_options_recover_wallet_button'),
    )
}

const waitForImportButtonEnabled = async () => {
    await waitFor(() => {
        expect(
            (
                screen.getByTestId(
                    'import_account_import_button',
                ) as HTMLButtonElement
            ).disabled,
        ).toBe(false)
    })
}

const startAlgo25ImportThroughMnemonic = async (words: string[]) => {
    renderAlgo25ImportFromOnboarding()
    await openImportOptionsSheet()
    await waitFor(() => screen.getByTestId('import_options_algo25_button'))
    fireEvent.click(screen.getByTestId('import_options_algo25_button'))
    await advanceThroughImportInfo()
    await waitFor(() => screen.getByTestId('import_account_word_input_24'))
    typeWordsIndividually(words)
    await waitForImportButtonEnabled()
    fireEvent.click(screen.getByTestId('import_account_import_button'))
}

// Real algo25 key derivation (tweetnacl + algokit) plus several screen
// transitions and an indexer round trip — bump above the 5s default.
const SLOW_TEST_TIMEOUT_MS = 30_000

describe('Flow: Onboarding → Import Algo25 (legacy)', () => {
    beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }))
    afterEach(() => server.resetHandlers())
    afterAll(() => server.close())

    beforeEach(() => {
        resetTestKeystore()
        useAccountsStore.getState().setAccounts([])
        useOnboardingStore.getState().reset()
        vi.mocked(Notifier.showNotification).mockClear()

        // No rekeyed accounts on-chain → SearchAccounts auto-exits via
        // useExitAccountFlow once it confirms the imported address has no
        // rekey history.
        server.use(mockIndexerSearchForAccounts())
    })

    it(
        'Given a valid 25-word mnemonic, when the user advances through Algo25 import, then the derived account is persisted and onboarding completes',
        async () => {
            renderAlgo25ImportFromOnboarding()

            await openImportOptionsSheet()
            await waitFor(() =>
                screen.getByTestId('import_options_algo25_button'),
            )
            fireEvent.click(screen.getByTestId('import_options_algo25_button'))

            await advanceThroughImportInfo()

            // Algo25 import uses 25 input slots.
            await waitFor(() =>
                screen.getByTestId('import_account_word_input_24'),
            )

            // The Quantum-only collision explainer must NOT appear on a
            // standard algo25 import (it shares the ImportAccountScreen).
            expect(
                screen.queryByTestId('import_account_quantum_note'),
            ).toBeNull()

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

            // Algo25 differs from HD: useImportAccount creates the account
            // immediately (not session-pending), so it lands in the store before
            // SearchAccounts even runs. SearchAccounts then checks for rekeyed
            // accounts and, finding none, routes to NameAccount for the user to
            // confirm/customize the name before finishing.
            await waitFor(() =>
                screen.getByTestId('name_account_finish_button'),
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
            expect(accounts[0].type).toBe(AccountTypes.algo25)
            expect(accounts[0].address).toBe(ALGO25_TEST_ADDRESS)
            expect(useAccountsStore.getState().selectedAccountAddress).toBe(
                ALGO25_TEST_ADDRESS,
            )
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given the Algo25 word slots are rendered on iOS, then every slot requests the ASCII-capable keyboard so an IME cannot enter its composing state',
        async () => {
            renderAlgo25ImportFromOnboarding()

            await openImportOptionsSheet()
            await waitFor(() =>
                screen.getByTestId('import_options_algo25_button'),
            )
            fireEvent.click(screen.getByTestId('import_options_algo25_button'))

            await advanceThroughImportInfo()

            await waitFor(() =>
                screen.getByTestId('import_account_word_input_24'),
            )

            for (let idx = 0; idx < 25; idx++) {
                expect(
                    screen
                        .getByTestId(`import_account_word_input_${idx}`)
                        .getAttribute('keyboardType'),
                ).toBe('ascii-capable')
            }
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given an invalid 25-word mnemonic, when the user taps Import, then an error toast is raised and no account is persisted',
        async () => {
            renderAlgo25ImportFromOnboarding()

            await openImportOptionsSheet()
            await waitFor(() =>
                screen.getByTestId('import_options_algo25_button'),
            )
            fireEvent.click(screen.getByTestId('import_options_algo25_button'))

            await advanceThroughImportInfo()

            await waitFor(() =>
                screen.getByTestId('import_account_word_input_24'),
            )
            typeWordsIndividually(INVALID_ALGO25_MNEMONIC_WORDS)

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

            await waitFor(
                () => {
                    expect(
                        vi.mocked(Notifier.showNotification),
                    ).toHaveBeenCalled()
                },
                { timeout: 5000 },
            )

            expect(useAccountsStore.getState().accounts).toHaveLength(0)
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given the imported address has rekeyed accounts, when SearchAccounts runs, then the rekeyed addresses screen is shown',
        async () => {
            // Override the default no-rekeys handler — indexer now reports a
            // single watch candidate, so SearchAccounts navigates into the
            // rekey selection screen instead of exiting the flow.
            server.use(
                mockIndexerSearchForAccounts({
                    response: { accounts: [{ address: REKEY_TARGET_ADDRESS }] },
                }),
            )

            await startAlgo25ImportThroughMnemonic(ALGO25_TEST_MNEMONIC_WORDS)

            await waitFor(
                () => {
                    expect(
                        screen.getByTestId('import_rekeyed_addresses_screen'),
                    ).toBeTruthy()
                },
                { timeout: 5000 },
            )

            // The algo25 import already persisted the master before rekey
            // discovery ran (createAlgo25WalletAccount writes to the store
            // synchronously); confirm it survived.
            const accounts = useAccountsStore.getState().accounts
            expect(accounts).toHaveLength(1)
            expect(accounts[0].address).toBe(ALGO25_TEST_ADDRESS)
            expect(accounts[0].type).toBe(AccountTypes.algo25)
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given the same algo25 address is already in the wallet, when the user re-imports the mnemonic, then a duplicate-account toast is raised and no second copy is stored',
        async () => {
            // Pre-seed the accounts store with the address the test mnemonic
            // would derive. The import flow should detect the duplicate and
            // surface a tailored toast instead of silently appending a second
            // copy.
            useAccountsStore.getState().setAccounts([
                {
                    id: 'existing-algo25-1',
                    type: AccountTypes.algo25,
                    address: ALGO25_TEST_ADDRESS,
                    keyPairId: 'pre-seeded',
                },
            ])

            await startAlgo25ImportThroughMnemonic(ALGO25_TEST_MNEMONIC_WORDS)

            // useImportAccount throws DuplicateAccountError, which the
            // ImportAccountScreen's catch turns into the duplicate-account
            // toast. The notifier mock records the call.
            await waitFor(
                () => {
                    expect(
                        vi.mocked(Notifier.showNotification),
                    ).toHaveBeenCalled()
                },
                { timeout: 5000 },
            )

            // No duplicate of `ALGO25_TEST_ADDRESS` was added — the accounts
            // store still contains a single entry for that address.
            const matching = useAccountsStore
                .getState()
                .accounts.filter(a => a.address === ALGO25_TEST_ADDRESS)
            expect(matching).toHaveLength(1)
            // And only the original pre-seeded entry remains overall.
            expect(useAccountsStore.getState().accounts).toHaveLength(1)
            expect(useAccountsStore.getState().accounts[0].id).toBe(
                'existing-algo25-1',
            )
        },
        SLOW_TEST_TIMEOUT_MS,
    )
})

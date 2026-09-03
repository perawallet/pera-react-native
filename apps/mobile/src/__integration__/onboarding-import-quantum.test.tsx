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
import { useRemoteConfigStore } from '@perawallet/wallet-core-remote-config'
import { useOnboardingStore } from '@modules/onboarding/hooks/useOnboardingStore'
import {
    mockAlgodAccountInformation,
    mockIndexerSearchForAccounts,
} from '@perawallet/wallet-core-blockchain/test-handlers'

import {
    ALGO25_TEST_ADDRESS,
    ALGO25_TEST_MNEMONIC_WORDS,
} from './__fixtures__/onboarding'
import {
    QUANTUM_TEST_ADDRESS,
    QUANTUM_TEST_LEGACY_ADDRESS,
} from './__fixtures__/quantum'

const QUANTUM_FLAG = 'enable_quantum_accounts'

/**
 * Turn the quantum-accounts flag on via the real remote-config override
 * (mirrors sign-review-quantum-fee.test.tsx). The store persists, so its
 * async rehydration can otherwise land after the value is set and wipe it —
 * await hydration first so the override sticks for the render under test.
 */
const enableQuantumFlag = async (): Promise<void> => {
    await useRemoteConfigStore.persist.rehydrate()
    useRemoteConfigStore.getState().setConfigOverride(QUANTUM_FLAG, true)
}

const typeWordsIndividually = (words: string[]) => {
    words.forEach((word, idx) => {
        fireEvent.change(
            screen.getByTestId(`import_account_word_input_${idx}`),
            { target: { value: word } },
        )
    })
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

// Renders the GENERIC "Recover a wallet" flow (mirrors
// onboarding-import-algo25.test.tsx) — used only by the cross-flow collision
// regression test below, which must prove that the same 25 words fed through
// the standard algo25 entrypoint derive a different address than the
// dedicated Quantum entrypoint.
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

const openImportOptionsSheet = async () => {
    fireEvent.click(screen.getByTestId('onboarding_import_account_button'))
    await waitFor(() =>
        screen.getByTestId('import_account_options_recover_wallet_button'),
    )
    fireEvent.click(
        screen.getByTestId('import_account_options_recover_wallet_button'),
    )
}

const advanceThroughImportInfo = async () => {
    await waitFor(() => screen.getByTestId('import_info_recover_button'))
    fireEvent.click(screen.getByTestId('import_info_recover_button'))
}

// Drives the generic algo25 "Recover a wallet" flow all the way from
// Onboarding through the type-selection sheet, ImportInfo and the 25-word
// mnemonic screen, submitting the given words.
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

// Real quantum key derivation (Falcon mock + keystore) plus several screen
// transitions and an indexer round trip — bump above the 5s default.
const SLOW_TEST_TIMEOUT_MS = 30_000

describe('Flow: Onboarding → Import Quantum (25-word)', () => {
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
        vi.mocked(Notifier.showNotification).mockClear()

        // No rekeyed accounts on-chain → SearchAccounts must route the quantum
        // account on to NameAccount (the fix for the hang) rather than stalling
        // on the "Searching your accounts" step.
        server.use(mockIndexerSearchForAccounts())

        // Dual-probe import: neither candidate address has
        // on-chain activity for this pinned test mnemonic, so the import
        // resolves to canonical-only — the single-account flow these tests
        // already exercise.
        server.use(
            mockAlgodAccountInformation({
                address: QUANTUM_TEST_ADDRESS,
                response: {},
            }),
            mockAlgodAccountInformation({
                address: QUANTUM_TEST_LEGACY_ADDRESS,
                response: {},
            }),
        )
    })

    it(
        'Given a valid 25-word mnemonic, when the user imports through the Quantum entrypoint, then the explainer note renders, a quantum account is persisted at the Falcon-derived address, and onboarding completes without hanging on the search step',
        async () => {
            await enableQuantumFlag()
            renderQuantumImportFromOnboarding()

            await openQuantumImportScreen()

            // The collision-guard explainer must actually render on the screen
            // (a 25-word regular Algorand phrase is not a Quantum account).
            expect(
                screen.getByTestId('import_account_quantum_note'),
            ).toBeTruthy()

            typeWordsIndividually(ALGO25_TEST_MNEMONIC_WORDS)

            await waitForImportButtonEnabled()

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
            expect(accounts[0].address).toBe(QUANTUM_TEST_ADDRESS)
            expect(useAccountsStore.getState().selectedAccountAddress).toBe(
                accounts[0].address,
            )
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given the same quantum address is already in the wallet, when the user re-imports the mnemonic through the Quantum entrypoint, then a duplicate-account toast is raised and no second copy is stored',
        async () => {
            await enableQuantumFlag()

            // Pre-seed the accounts store with the address the test mnemonic
            // derives under the Falcon (quantum) path. The import flow should
            // detect the duplicate and surface a tailored toast instead of
            // silently appending a second copy.
            useAccountsStore.getState().setAccounts([
                {
                    id: 'existing-quantum-1',
                    type: AccountTypes.quantum,
                    address: QUANTUM_TEST_ADDRESS,
                    keyPairId: 'pre-seeded',
                },
            ])

            renderQuantumImportFromOnboarding()
            await openQuantumImportScreen()

            typeWordsIndividually(ALGO25_TEST_MNEMONIC_WORDS)

            await waitForImportButtonEnabled()

            fireEvent.click(screen.getByTestId('import_account_import_button'))

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

            // No duplicate of `QUANTUM_TEST_ADDRESS` was added — the accounts
            // store still contains a single entry for that address.
            const matching = useAccountsStore
                .getState()
                .accounts.filter(a => a.address === QUANTUM_TEST_ADDRESS)
            expect(matching).toHaveLength(1)
            // And only the original pre-seeded entry remains overall.
            expect(useAccountsStore.getState().accounts).toHaveLength(1)
            expect(useAccountsStore.getState().accounts[0].id).toBe(
                'existing-quantum-1',
            )
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given the same 25 words are imported through the generic Recover-a-wallet (algo25) flow instead of the Quantum entrypoint, then a standard algo25 account is persisted at a different address than the Quantum derivation',
        async () => {
            // Deliberately does NOT enable the quantum flag — the generic
            // recover flow does not depend on it, and this test exercises the
            // collision regression from the algo25 side only.
            await startAlgo25ImportThroughMnemonic(ALGO25_TEST_MNEMONIC_WORDS)

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

            // Same 25 words, two different derivations: ed25519 (algo25) vs
            // Falcon (quantum). This is the collision guard's entire premise.
            expect(ALGO25_TEST_ADDRESS).not.toBe(QUANTUM_TEST_ADDRESS)

            const accounts = useAccountsStore.getState().accounts
            expect(accounts).toHaveLength(1)
            expect(accounts[0].type).toBe(AccountTypes.algo25)
            expect(accounts[0].address).toBe(ALGO25_TEST_ADDRESS)
        },
        SLOW_TEST_TIMEOUT_MS,
    )
})

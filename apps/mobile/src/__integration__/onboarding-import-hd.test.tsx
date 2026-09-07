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
import { ImportSelectAddressesScreen } from '@modules/onboarding/screens/ImportSelectAddressesScreen/ImportSelectAddressesScreen'
import { ImportRekeyedAddressesScreen } from '@modules/onboarding/screens/ImportRekeyedAddressesScreen/ImportRekeyedAddressesScreen'
import { NameAccountScreen } from '@modules/onboarding/screens/NameAccountScreen/NameAccountScreen'
import {
    AccountTypes,
    DerivationTypes,
    useAccountsStore,
} from '@perawallet/wallet-core-accounts'
import { useOnboardingStore } from '@modules/onboarding/hooks/useOnboardingStore'
import { mockAccountFastLookup } from '@perawallet/wallet-core-shared/test-handlers'
import { mockIndexerSearchForAccounts } from '@perawallet/wallet-core-blockchain/test-handlers'

import {
    deriveTestHDAddress,
    HD_TEST_ADDRESS,
    HD_TEST_MNEMONIC_24_WORDS,
    INVALID_HD_MNEMONIC_24_WORDS,
    REKEY_TARGET_ADDRESS,
} from './__fixtures__/onboarding'

// Helper: type each word of the supplied mnemonic into the import inputs.
// `useImportAccountScreen` recognises a single-input multi-word paste, so
// typing the words one at a time exercises the per-word path; for a paste
// scenario, set the first input to the joined string.
const typeWordsIndividually = (words: string[]) => {
    words.forEach((word, idx) => {
        fireEvent.change(
            screen.getByTestId(`import_account_word_input_${idx}`),
            {
                target: { value: word },
            },
        )
    })
}

// ImportInfoScreen renders a single PWButton (the "Recover" CTA). The
// component mock keys it under the default 'PWButton' testid because the
// production source doesn't pass an explicit one. This helper waits for it
// to mount, then advances to ImportAccount.
const advanceThroughImportInfo = async () => {
    await waitFor(() => screen.getByTestId('import_info_recover_button'))
    fireEvent.click(screen.getByTestId('import_info_recover_button'))
}

// A single-account import lands on NameAccount; confirm the default name to
// finish onboarding. (Multi-address imports keep auto-names and skip this.)
const advanceThroughNameAccount = async () => {
    await waitFor(() => screen.getByTestId('name_account_finish_button'))
    fireEvent.click(screen.getByTestId('name_account_finish_button'))
}

const renderHDImportFromOnboarding = () =>
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
                name: 'ImportSelectAddresses',
                component: ImportSelectAddressesScreen,
            },
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

const startHDImportThroughMnemonic = async (words: string[]) => {
    renderHDImportFromOnboarding()
    await openImportOptionsSheet()
    await waitFor(() => screen.getByTestId('import_options_hd_wallet_button'))
    fireEvent.click(screen.getByTestId('import_options_hd_wallet_button'))
    await advanceThroughImportInfo()
    await waitFor(() => screen.getByTestId('import_account_word_input_0'))
    typeWordsIndividually(words)
    await waitForImportButtonEnabled()
    fireEvent.click(screen.getByTestId('import_account_import_button'))
}

// Per-test timeout: HD import runs real BIP39 + xhd-wallet-api derivation,
// followed by several screen transitions and an MSW round trip per
// candidate address. Bump above the 5s vitest default.
const SLOW_TEST_TIMEOUT_MS = 30_000

describe('Flow: Onboarding → Import HD wallet', () => {
    beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }))
    afterEach(() => server.resetHandlers())
    afterAll(() => server.close())

    beforeEach(() => {
        resetTestKeystore()
        useAccountsStore.getState().setAccounts([])
        useOnboardingStore.getState().reset()
        vi.mocked(Notifier.showNotification).mockClear()

        // Default scenario: no on-chain activity for any address →
        // discovery returns just the zero (master) account. No rekeyed
        // accounts → SearchAccounts navigates straight to selection then
        // exits cleanly after commit.
        server.use(
            mockAccountFastLookup({
                address: HD_TEST_ADDRESS,
                response: { account_exists: false },
            }),
            // The discovery scan probes addresses we can't predict ahead of
            // time. Default any other fast-lookup probe to "no activity".
            mockAccountFastLookup({
                address: ':any',
                response: { account_exists: false },
            }),
            // No rekeyed accounts on-chain.
            mockIndexerSearchForAccounts(),
        )
    })

    it(
        'Given a valid 24-word mnemonic, when the user advances through HD import, then the derived account is persisted and onboarding completes',
        async () => {
            renderHDImportFromOnboarding()

            // Open the import options sheet.
            await openImportOptionsSheet()
            await waitFor(() =>
                screen.getByTestId('import_options_hd_wallet_button'),
            )
            fireEvent.click(
                screen.getByTestId('import_options_hd_wallet_button'),
            )

            await advanceThroughImportInfo()

            await waitFor(() =>
                screen.getByTestId('import_account_word_input_0'),
            )

            typeWordsIndividually(HD_TEST_MNEMONIC_24_WORDS)

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

            // SearchAccounts kicks off discovery on mount. With no on-chain
            // activity it falls back to a single "zero account" (the master),
            // then replaces to ImportSelectAddresses with that single entry.
            await waitFor(
                () => {
                    expect(
                        screen.getByTestId(
                            'import_select_addresses_continue_button',
                        ),
                    ).toBeTruthy()
                },
                { timeout: 5000 },
            )

            // The first new account is auto-selected (see
            // useImportSelectAddressesScreen). Continue commits the import.
            fireEvent.click(
                screen.getByTestId('import_select_addresses_continue_button'),
            )

            // Single committed account → name it before finishing.
            await advanceThroughNameAccount()

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
            expect(accounts[0].type).toBe(AccountTypes.hdWallet)
            expect(accounts[0].address).toBe(HD_TEST_ADDRESS)
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given an invalid mnemonic, when the user taps Import, then an error toast is raised and no account is persisted',
        async () => {
            renderHDImportFromOnboarding()

            await openImportOptionsSheet()
            await waitFor(() =>
                screen.getByTestId('import_options_hd_wallet_button'),
            )
            fireEvent.click(
                screen.getByTestId('import_options_hd_wallet_button'),
            )

            await advanceThroughImportInfo()

            await waitFor(() =>
                screen.getByTestId('import_account_word_input_0'),
            )

            typeWordsIndividually(INVALID_HD_MNEMONIC_24_WORDS)

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

            // The notifier is invoked from the showToast hook on error.
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
        'Given the wallet was already imported, when re-importing, then the address is shown as already imported',
        async () => {
            // Pre-seed the accounts store with the HD master address. The flow
            // will rediscover the same address; ImportSelectAddresses must mark
            // it as already imported and offer no new selections.
            useAccountsStore.getState().setAccounts([
                {
                    id: 'existing-1',
                    type: AccountTypes.hdWallet,
                    address: HD_TEST_ADDRESS,
                    keyPairId: 'pre-seeded',
                    hdWalletDetails: {
                        account: 0,
                        change: 0,
                        keyIndex: 0,
                        derivationType: DerivationTypes.Peikert,
                    },
                },
            ])

            renderHDImportFromOnboarding()

            await openImportOptionsSheet()
            await waitFor(() =>
                screen.getByTestId('import_options_hd_wallet_button'),
            )
            fireEvent.click(
                screen.getByTestId('import_options_hd_wallet_button'),
            )

            await advanceThroughImportInfo()

            await waitFor(() =>
                screen.getByTestId('import_account_word_input_0'),
            )
            typeWordsIndividually(HD_TEST_MNEMONIC_24_WORDS)

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
                        screen.getByTestId(
                            'import_select_addresses_continue_button',
                        ),
                    ).toBeTruthy()
                },
                { timeout: 5000 },
            )

            // Already-imported addresses render a chip instead of a checkbox,
            // so the per-address checkbox is absent.
            expect(
                screen.queryByTestId(
                    `import_select_addresses_item_checkbox_${HD_TEST_ADDRESS}`,
                ),
            ).toBeFalsy()

            // The accounts store is unchanged — still just the pre-seeded entry.
            expect(useAccountsStore.getState().accounts).toHaveLength(1)
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given discovery finds three derived addresses, when the user keeps the default selection and continues, then only that one address is persisted',
        async () => {
            // Pre-compute the addresses discovery would surface for keyIndex
            // 0–2 of account 0. We mock fast-lookup to return `account_exists`
            // for these three; the catch-all returns false so the scan stops
            // after the first key-gap of 5 misses, leaving exactly three
            // candidates in the selection list.
            const addr0 = HD_TEST_ADDRESS // (account 0, keyIndex 0)
            const addr1 = await deriveTestHDAddress(0, 1)
            const addr2 = await deriveTestHDAddress(0, 2)

            server.use(
                mockAccountFastLookup({
                    address: addr0,
                    response: { account_exists: true },
                }),
                mockAccountFastLookup({
                    address: addr1,
                    response: { account_exists: true },
                }),
                mockAccountFastLookup({
                    address: addr2,
                    response: { account_exists: true },
                }),
                // Catch-all: any other probed address has no on-chain history.
                mockAccountFastLookup({
                    address: ':any',
                    response: { account_exists: false },
                }),
                mockIndexerSearchForAccounts(),
            )

            await startHDImportThroughMnemonic(HD_TEST_MNEMONIC_24_WORDS)

            // All three checkboxes render — the first is auto-selected by the
            // hook (`new Set([newAccounts[0].address])`).
            await waitFor(
                () => {
                    expect(
                        screen.getByTestId(
                            `import_select_addresses_item_checkbox_${addr0}`,
                        ),
                    ).toBeTruthy()
                },
                { timeout: 5000 },
            )
            expect(
                screen.getByTestId(
                    `import_select_addresses_item_checkbox_${addr1}`,
                ),
            ).toBeTruthy()
            expect(
                screen.getByTestId(
                    `import_select_addresses_item_checkbox_${addr2}`,
                ),
            ).toBeTruthy()

            // Continue with only the auto-selected first address.
            fireEvent.click(
                screen.getByTestId('import_select_addresses_continue_button'),
            )

            // Single committed account → name it before finishing.
            await advanceThroughNameAccount()

            await waitFor(
                () => {
                    expect(useOnboardingStore.getState().isOnboarding).toBe(
                        false,
                    )
                },
                { timeout: 5000 },
            )

            // Exactly the auto-selected (first) address is persisted; the other
            // two discovered candidates are dropped.
            const accounts = useAccountsStore.getState().accounts
            expect(accounts).toHaveLength(1)
            expect(accounts[0].address).toBe(addr0)
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given discovery finds three derived addresses, when the user toggles the selection so only the third is selected, then only that address is persisted',
        async () => {
            const addr0 = HD_TEST_ADDRESS
            const addr1 = await deriveTestHDAddress(0, 1)
            const addr2 = await deriveTestHDAddress(0, 2)

            server.use(
                mockAccountFastLookup({
                    address: addr0,
                    response: { account_exists: true },
                }),
                mockAccountFastLookup({
                    address: addr1,
                    response: { account_exists: true },
                }),
                mockAccountFastLookup({
                    address: addr2,
                    response: { account_exists: true },
                }),
                mockAccountFastLookup({
                    address: ':any',
                    response: { account_exists: false },
                }),
                mockIndexerSearchForAccounts(),
            )

            await startHDImportThroughMnemonic(HD_TEST_MNEMONIC_24_WORDS)

            await waitFor(
                () => {
                    expect(
                        screen.getByTestId(
                            `import_select_addresses_item_checkbox_${addr2}`,
                        ),
                    ).toBeTruthy()
                },
                { timeout: 5000 },
            )

            // ImportSelectAddressesScreen wraps each row in a PWTouchableOpacity
            // whose onPress *also* calls toggleSelection. In RN, tapping the
            // checkbox doesn't bubble to the row; under jsdom every click does,
            // double-firing the handler and netting zero. Click the row's
            // wrapping button (the parent of the checkbox) so only the row's
            // onPress fires once.
            const rowOf = (address: string): HTMLElement => {
                const checkbox = screen.getByTestId(
                    `import_select_addresses_item_checkbox_${address}`,
                )
                const row = checkbox.closest('button')
                if (!row) {
                    throw new Error(`Row button not found for ${address}`)
                }
                return row
            }
            fireEvent.click(rowOf(addr0))
            fireEvent.click(rowOf(addr2))

            fireEvent.click(
                screen.getByTestId('import_select_addresses_continue_button'),
            )

            // Single committed account → name it before finishing.
            await advanceThroughNameAccount()

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
            expect(accounts[0].address).toBe(addr2)
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given discovery finds rekeyed addresses, when the user commits the selection, then the rekeyed addresses screen is shown',
        async () => {
            // Default fast-lookup mock is "no on-chain activity" → discovery
            // returns just the master. Indexer rekey lookup returns one watch
            // candidate, which routes to ImportRekeyedAddresses after the
            // commit (rather than exiting the flow).
            server.use(
                mockAccountFastLookup({
                    address: ':any',
                    response: { account_exists: false },
                }),
                mockIndexerSearchForAccounts({
                    response: { accounts: [{ address: REKEY_TARGET_ADDRESS }] },
                }),
            )

            await startHDImportThroughMnemonic(HD_TEST_MNEMONIC_24_WORDS)

            await waitFor(
                () => {
                    expect(
                        screen.getByTestId(
                            'import_select_addresses_continue_button',
                        ),
                    ).toBeTruthy()
                },
                { timeout: 5000 },
            )

            fireEvent.click(
                screen.getByTestId('import_select_addresses_continue_button'),
            )

            // commitImport persists the master before navigating to the rekey
            // screen — the master is in the accounts store regardless of
            // whether the user later commits the rekey selection.
            await waitFor(
                () => {
                    expect(
                        screen.getByTestId('import_rekeyed_addresses_screen'),
                    ).toBeTruthy()
                },
                { timeout: 5000 },
            )
            expect(
                screen.getByTestId('import_rekeyed_addresses_continue_button'),
            ).toBeTruthy()

            const accounts = useAccountsStore.getState().accounts
            expect(accounts).toHaveLength(1)
            expect(accounts[0].address).toBe(HD_TEST_ADDRESS)
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given discovery finds three derived addresses each with a rekey, when the user commits the selection, then both screens flow into ImportRekeyedAddresses',
        async () => {
            const addr0 = HD_TEST_ADDRESS
            const addr1 = await deriveTestHDAddress(0, 1)
            const addr2 = await deriveTestHDAddress(0, 2)

            server.use(
                mockAccountFastLookup({
                    address: addr0,
                    response: { account_exists: true },
                }),
                mockAccountFastLookup({
                    address: addr1,
                    response: { account_exists: true },
                }),
                mockAccountFastLookup({
                    address: addr2,
                    response: { account_exists: true },
                }),
                mockAccountFastLookup({
                    address: ':any',
                    response: { account_exists: false },
                }),
                // Every rekey lookup returns the same watch candidate. After
                // commit, discoverRekeyedAccounts probes ALL discovered
                // addresses (route param `accounts`, not just the selected
                // ones), so the rekey screen lists three entries — all the
                // same target.
                mockIndexerSearchForAccounts({
                    response: { accounts: [{ address: REKEY_TARGET_ADDRESS }] },
                }),
            )

            await startHDImportThroughMnemonic(HD_TEST_MNEMONIC_24_WORDS)

            await waitFor(
                () => {
                    expect(
                        screen.getByTestId(
                            `import_select_addresses_item_checkbox_${addr0}`,
                        ),
                    ).toBeTruthy()
                },
                { timeout: 5000 },
            )

            fireEvent.click(
                screen.getByTestId('import_select_addresses_continue_button'),
            )

            await waitFor(
                () => {
                    expect(
                        screen.getByTestId('import_rekeyed_addresses_screen'),
                    ).toBeTruthy()
                },
                { timeout: 5000 },
            )

            // The selected derived address (addr0 by default) is persisted.
            const accounts = useAccountsStore.getState().accounts
            expect(accounts).toHaveLength(1)
            expect(accounts[0].address).toBe(addr0)
        },
        SLOW_TEST_TIMEOUT_MS,
    )
})

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
import * as Clipboard from 'expo-clipboard'
import { File } from 'expo-file-system'
import { Notifier } from 'react-native-notifier'

import { server } from '@test-utils/msw-server'
import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import { resetTestKeystore } from '@test-utils/algorand-keystore-test'
import { OnboardingScreen } from '@modules/onboarding/screens/OnboardingScreen/OnboardingScreen'
import { ImportAccountOptionsScreen } from '@modules/onboarding/screens/ImportAccountOptionsScreen/ImportAccountOptionsScreen'
import { AsbImportInfoScreen } from '@modules/onboarding/screens/AsbImportInfoScreen'
import { AsbImportBackupScreen } from '@modules/onboarding/screens/AsbImportBackupScreen'
import { AsbImportKeyScreen } from '@modules/onboarding/screens/AsbImportKeyScreen'
import { AsbImportSelectAccountsScreen } from '@modules/onboarding/screens/AsbImportSelectAccountsScreen'
import { AsbImportResultScreen } from '@modules/onboarding/screens/AsbImportResultScreen'
import {
    AccountTypes,
    useAccountsStore,
} from '@perawallet/wallet-core-accounts'
import { useOnboardingStore } from '@modules/onboarding/hooks/useOnboardingStore'
import { useAsbImportFlowStore } from '@modules/onboarding/hooks/asbImportFlowStore'

import {
    ALGO25_TEST_ADDRESS,
    ALGO25_TEST_MNEMONIC,
} from './__fixtures__/onboarding'
import {
    ASB_RECOVERY_MNEMONIC_WORDS,
    ASB_WATCH_ADDRESS,
    ASB_WRONG_RECOVERY_MNEMONIC_WORDS,
    buildAsbBackupFile,
    buildMixedAsbBackup,
    buildSingleAccountAsbBackup,
} from './__fixtures__/asb'
import { seedFromMnemonic } from 'algosdk'

// Backup decryption is synchronous but the screen yields to React after
// setting `isProcessing` so the loading overlay can paint; together with
// keystore commits, navigations, and the cascading store rewrites this
// pushes well past Vitest's 5 s default.
const SLOW_TEST_TIMEOUT_MS = 30_000

const renderAsbImportFromOnboarding = () =>
    renderWithNavigation(OnboardingScreen, 'Onboarding', {
        additionalScreens: [
            {
                name: 'ImportAccountOptions',
                component: ImportAccountOptionsScreen,
            },
            { name: 'AsbImportInfo', component: AsbImportInfoScreen },
            { name: 'AsbImportBackup', component: AsbImportBackupScreen },
            { name: 'AsbImportKey', component: AsbImportKeyScreen },
            {
                name: 'AsbImportSelectAccounts',
                component: AsbImportSelectAccountsScreen,
            },
            { name: 'AsbImportResult', component: AsbImportResultScreen },
        ],
    })

// Fake `File` instance returned from `File.pickFileAsync`. The screen reads
// `.text()` synchronously after the user taps the drop zone, so we just need
// a thenable that resolves to the envelope string.
const fakeFileFor = (contents: string) =>
    ({
        name: 'mock-backup.txt',
        text: async () => contents,
    }) as unknown as File

const openImportOptions = async () => {
    fireEvent.click(screen.getByTestId('onboarding_import_account_button'))
    await waitFor(() => screen.getByTestId('import_account_options_asb_button'))
}

const enterAsbFlow = async () => {
    await openImportOptions()
    fireEvent.click(screen.getByTestId('import_account_options_asb_button'))
    await waitFor(() => screen.getByTestId('asb_import_info_continue_button'))
    fireEvent.click(screen.getByTestId('asb_import_info_continue_button'))
    await waitFor(() =>
        screen.getByTestId('asb_import_backup_pick_file_button'),
    )
}

const typeRecoveryWords = (words: string[]) => {
    words.forEach((word, idx) => {
        fireEvent.change(screen.getByTestId(`asb_import_key_word_${idx}`), {
            target: { value: word },
        })
    })
}

const waitForButtonEnabled = async (testID: string) => {
    await waitFor(() => {
        expect((screen.getByTestId(testID) as HTMLButtonElement).disabled).toBe(
            false,
        )
    })
}

describe('Flow: Onboarding → Import from Algorand Secure Backup', () => {
    beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }))
    afterEach(() => server.resetHandlers())
    afterAll(() => server.close())

    beforeEach(() => {
        resetTestKeystore()
        useAccountsStore.getState().setAccounts([])
        useOnboardingStore.getState().reset()
        useAsbImportFlowStore.getState().reset()
        vi.mocked(Notifier.showNotification).mockClear()
        vi.mocked(File.pickFileAsync).mockReset()
        vi.mocked(Clipboard.getStringAsync).mockReset()
    })

    it(
        'Given the recovery-key word slots are rendered on iOS, then every slot requests the ASCII-capable keyboard so an IME cannot enter its composing state',
        async () => {
            vi.mocked(File.pickFileAsync).mockResolvedValueOnce(
                fakeFileFor(buildSingleAccountAsbBackup()),
            )

            renderAsbImportFromOnboarding()
            await enterAsbFlow()

            fireEvent.click(
                screen.getByTestId('asb_import_backup_pick_file_button'),
            )
            await waitForButtonEnabled('asb_import_backup_continue_button')
            fireEvent.click(
                screen.getByTestId('asb_import_backup_continue_button'),
            )

            await waitFor(() => screen.getByTestId('asb_import_key_word_0'))

            for (let idx = 0; idx < ASB_RECOVERY_MNEMONIC_WORDS.length; idx++) {
                expect(
                    screen
                        .getByTestId(`asb_import_key_word_${idx}`)
                        .getAttribute('keyboardType'),
                ).toBe('ascii-capable')
            }
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given a valid backup file picked from disk and the correct recovery key, the single account lands in the wallet',
        async () => {
            vi.mocked(File.pickFileAsync).mockResolvedValueOnce(
                fakeFileFor(buildSingleAccountAsbBackup()),
            )

            renderAsbImportFromOnboarding()
            await enterAsbFlow()

            fireEvent.click(
                screen.getByTestId('asb_import_backup_pick_file_button'),
            )

            // The picker resolves async and triggers a state update that
            // re-renders the file row. Wait for the Next button to enable.
            await waitForButtonEnabled('asb_import_backup_continue_button')
            fireEvent.click(
                screen.getByTestId('asb_import_backup_continue_button'),
            )

            await waitFor(() => screen.getByTestId('asb_import_key_word_0'))
            typeRecoveryWords(ASB_RECOVERY_MNEMONIC_WORDS)
            await waitForButtonEnabled('asb_import_key_continue_button')
            fireEvent.click(
                screen.getByTestId('asb_import_key_continue_button'),
            )

            // Select-accounts screen pre-selects the importable rows, so the
            // continue button is enabled immediately on mount.
            await waitFor(() =>
                screen.getByTestId('asb_import_select_continue_button'),
            )
            await waitForButtonEnabled('asb_import_select_continue_button')
            fireEvent.click(
                screen.getByTestId('asb_import_select_continue_button'),
            )

            // The import runs through the real algo25 keystore commit, then
            // navigates to the result screen with `importedCount=1`.
            await waitFor(
                () => {
                    expect(useAccountsStore.getState().accounts).toHaveLength(1)
                },
                { timeout: 10_000 },
            )

            const [account] = useAccountsStore.getState().accounts
            expect(account.type).toBe(AccountTypes.algo25)
            expect(account.address).toBe(ALGO25_TEST_ADDRESS)
            expect(account.name).toBe('Algo25 from ASB')

            // Result screen rendered (the wrapper testID is reliable across
            // the PWResultView mock; individual count lines are PWText
            // children whose testID surfacing depends on the mock).
            await waitFor(() => screen.getByTestId('asb_import_result'))
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given a backup with one single and one watch account, both land in the wallet under their correct types',
        async () => {
            vi.mocked(File.pickFileAsync).mockResolvedValueOnce(
                fakeFileFor(buildMixedAsbBackup()),
            )

            renderAsbImportFromOnboarding()
            await enterAsbFlow()

            fireEvent.click(
                screen.getByTestId('asb_import_backup_pick_file_button'),
            )
            await waitForButtonEnabled('asb_import_backup_continue_button')
            fireEvent.click(
                screen.getByTestId('asb_import_backup_continue_button'),
            )

            await waitFor(() => screen.getByTestId('asb_import_key_word_0'))
            typeRecoveryWords(ASB_RECOVERY_MNEMONIC_WORDS)
            await waitForButtonEnabled('asb_import_key_continue_button')
            fireEvent.click(
                screen.getByTestId('asb_import_key_continue_button'),
            )

            await waitForButtonEnabled('asb_import_select_continue_button')
            fireEvent.click(
                screen.getByTestId('asb_import_select_continue_button'),
            )

            await waitFor(
                () => {
                    expect(useAccountsStore.getState().accounts).toHaveLength(2)
                },
                { timeout: 10_000 },
            )

            const addresses = useAccountsStore
                .getState()
                .accounts.map(a => a.address)
                .sort()
            expect(addresses).toEqual(
                [ALGO25_TEST_ADDRESS, ASB_WATCH_ADDRESS].sort(),
            )

            const algo25 = useAccountsStore
                .getState()
                .accounts.find(a => a.address === ALGO25_TEST_ADDRESS)
            const watch = useAccountsStore
                .getState()
                .accounts.find(a => a.address === ASB_WATCH_ADDRESS)
            expect(algo25?.type).toBe(AccountTypes.algo25)
            expect(watch?.type).toBe(AccountTypes.watch)
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given a valid backup file pasted from the clipboard, the import path works without the file picker',
        async () => {
            vi.mocked(Clipboard.getStringAsync).mockResolvedValueOnce(
                buildSingleAccountAsbBackup(),
            )

            renderAsbImportFromOnboarding()
            await enterAsbFlow()

            fireEvent.click(
                screen.getByTestId('asb_import_backup_paste_button'),
            )
            await waitForButtonEnabled('asb_import_backup_continue_button')
            fireEvent.click(
                screen.getByTestId('asb_import_backup_continue_button'),
            )

            await waitFor(() => screen.getByTestId('asb_import_key_word_0'))
            typeRecoveryWords(ASB_RECOVERY_MNEMONIC_WORDS)
            await waitForButtonEnabled('asb_import_key_continue_button')
            fireEvent.click(
                screen.getByTestId('asb_import_key_continue_button'),
            )

            await waitForButtonEnabled('asb_import_select_continue_button')
            fireEvent.click(
                screen.getByTestId('asb_import_select_continue_button'),
            )

            await waitFor(
                () => {
                    expect(useAccountsStore.getState().accounts).toHaveLength(1)
                },
                { timeout: 10_000 },
            )
            expect(useAccountsStore.getState().accounts[0].address).toBe(
                ALGO25_TEST_ADDRESS,
            )
            // File picker was never invoked — paste path is independent.
            expect(vi.mocked(File.pickFileAsync)).not.toHaveBeenCalled()
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given the wrong 12-word recovery key, decryption fails, an error toast is raised, and no account is imported',
        async () => {
            vi.mocked(File.pickFileAsync).mockResolvedValueOnce(
                fakeFileFor(buildSingleAccountAsbBackup()),
            )

            renderAsbImportFromOnboarding()
            await enterAsbFlow()

            fireEvent.click(
                screen.getByTestId('asb_import_backup_pick_file_button'),
            )
            await waitForButtonEnabled('asb_import_backup_continue_button')
            fireEvent.click(
                screen.getByTestId('asb_import_backup_continue_button'),
            )

            await waitFor(() => screen.getByTestId('asb_import_key_word_0'))
            // 12 valid BIP-39 words but a checksum that no real backup ever
            // used — the seed derives, the cipher key derives, but secretbox
            // open fails the MAC.
            typeRecoveryWords(ASB_WRONG_RECOVERY_MNEMONIC_WORDS)
            await waitForButtonEnabled('asb_import_key_continue_button')
            fireEvent.click(
                screen.getByTestId('asb_import_key_continue_button'),
            )

            await waitFor(
                () => {
                    expect(
                        vi.mocked(Notifier.showNotification),
                    ).toHaveBeenCalled()
                },
                { timeout: 5000 },
            )

            // Stayed on the key entry screen — selection never rendered.
            expect(
                screen.queryByTestId('asb_import_select_continue_button'),
            ).toBeNull()
            expect(useAccountsStore.getState().accounts).toHaveLength(0)
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given the backup contains an account that is already in the wallet, the recovery succeeds and the duplicate is counted as skipped, not failed',
        async () => {
            // Pre-seed the wallet with the algo25 entry that the fixture
            // would otherwise recover. The select screen should mark it
            // "Already imported" and lock its checkbox.
            useAccountsStore.getState().setAccounts([
                {
                    id: 'pre-seeded',
                    type: AccountTypes.algo25,
                    address: ALGO25_TEST_ADDRESS,
                    keyPairId: 'pre-seeded',
                },
            ])

            // Two-account backup so the user has *something* to import after
            // the duplicate is filtered out.
            vi.mocked(File.pickFileAsync).mockResolvedValueOnce(
                fakeFileFor(
                    buildAsbBackupFile({
                        accounts: [
                            {
                                address: ALGO25_TEST_ADDRESS,
                                seed: seedFromMnemonic(ALGO25_TEST_MNEMONIC),
                            },
                            {
                                address: ASB_WATCH_ADDRESS,
                                kind: 'watch',
                            },
                        ],
                    }),
                ),
            )

            renderAsbImportFromOnboarding()
            await enterAsbFlow()

            fireEvent.click(
                screen.getByTestId('asb_import_backup_pick_file_button'),
            )
            await waitForButtonEnabled('asb_import_backup_continue_button')
            fireEvent.click(
                screen.getByTestId('asb_import_backup_continue_button'),
            )

            await waitFor(() => screen.getByTestId('asb_import_key_word_0'))
            typeRecoveryWords(ASB_RECOVERY_MNEMONIC_WORDS)
            await waitForButtonEnabled('asb_import_key_continue_button')
            fireEvent.click(
                screen.getByTestId('asb_import_key_continue_button'),
            )

            // Only the watch row is importable — the algo25 row is locked
            // with the "Already imported" chip. Continue is still enabled
            // because the importable rows are pre-selected.
            await waitForButtonEnabled('asb_import_select_continue_button')
            fireEvent.click(
                screen.getByTestId('asb_import_select_continue_button'),
            )

            // Wallet ends up with the pre-existing algo25 + the recovered
            // watch; the algo25 from the backup is filtered, not imported
            // a second time.
            await waitFor(
                () => {
                    expect(useAccountsStore.getState().accounts).toHaveLength(2)
                },
                { timeout: 10_000 },
            )

            const algo25 = useAccountsStore
                .getState()
                .accounts.filter(a => a.address === ALGO25_TEST_ADDRESS)
            expect(algo25).toHaveLength(1)
            expect(algo25[0].id).toBe('pre-seeded')

            const watch = useAccountsStore
                .getState()
                .accounts.find(a => a.type === AccountTypes.watch)
            expect(watch?.address).toBe(ASB_WATCH_ADDRESS)
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given the loaded file is not a valid ASB envelope, an error toast is raised and the wizard cannot advance',
        async () => {
            vi.mocked(File.pickFileAsync).mockResolvedValueOnce(
                fakeFileFor('this is not a base64-encoded backup envelope'),
            )

            renderAsbImportFromOnboarding()
            await enterAsbFlow()

            fireEvent.click(
                screen.getByTestId('asb_import_backup_pick_file_button'),
            )

            // The validator runs synchronously after the picker resolves;
            // the toast fires and the Next button stays disabled because
            // no envelope was committed to the flow store.
            await waitFor(
                () => {
                    expect(
                        vi.mocked(Notifier.showNotification),
                    ).toHaveBeenCalled()
                },
                { timeout: 5000 },
            )

            expect(
                (
                    screen.getByTestId(
                        'asb_import_backup_continue_button',
                    ) as HTMLButtonElement
                ).disabled,
            ).toBe(true)
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given the user successfully imports an account, decrypted private keys are zeroed in place and the flow store is empty by the time the result screen renders',
        async () => {
            vi.mocked(File.pickFileAsync).mockResolvedValueOnce(
                fakeFileFor(buildSingleAccountAsbBackup()),
            )

            renderAsbImportFromOnboarding()
            await enterAsbFlow()

            fireEvent.click(
                screen.getByTestId('asb_import_backup_pick_file_button'),
            )
            await waitForButtonEnabled('asb_import_backup_continue_button')
            fireEvent.click(
                screen.getByTestId('asb_import_backup_continue_button'),
            )

            await waitFor(() => screen.getByTestId('asb_import_key_word_0'))
            typeRecoveryWords(ASB_RECOVERY_MNEMONIC_WORDS)
            await waitForButtonEnabled('asb_import_key_continue_button')
            fireEvent.click(
                screen.getByTestId('asb_import_key_continue_button'),
            )

            await waitForButtonEnabled('asb_import_select_continue_button')

            // Capture the decrypted private-key buffer before we kick off
            // the import. The flow store hands us back the same Uint8Array
            // reference, so we can check it was zeroed in place by the
            // import loop's `finally`. We duck-type on `.length` + `.some`
            // rather than `instanceof Uint8Array` — under jsdom, base64-js's
            // output may be from a different Uint8Array realm than the
            // test's, which breaks the instanceof check even though the
            // bytes are correct.
            const payload = useAsbImportFlowStore.getState().payload
            const privateKey = payload?.accounts[0]?.privateKey
            expect(privateKey).toBeTruthy()
            expect(privateKey!.length).toBeGreaterThan(0)
            expect(privateKey!.some(b => b !== 0)).toBe(true)

            fireEvent.click(
                screen.getByTestId('asb_import_select_continue_button'),
            )

            await waitFor(
                () => {
                    expect(useAccountsStore.getState().accounts).toHaveLength(1)
                },
                { timeout: 10_000 },
            )

            await waitFor(() => screen.getByTestId('asb_import_result'))

            // By the time the result screen renders, the loop's per-iteration
            // wipe + the pre-navigation reset() have already cleared every
            // decrypted buffer — an attacker who heap-dumps after the flow
            // completes finds nothing live, no matter when the user gets
            // around to tapping Done.
            expect(useAsbImportFlowStore.getState().payload).toBeNull()
            expect(privateKey!.every(b => b === 0)).toBe(true)

            // Tapping Done after the cleanup is a no-op for the store and
            // still exits the flow.
            fireEvent.click(screen.getByTestId('asb_import_result-primary'))
            expect(useAsbImportFlowStore.getState().payload).toBeNull()
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given the user navigates back into the backup screen after the flow has wiped the store, the displayed file is cleared and Continue is disabled',
        async () => {
            // Reproduces the user-reported back-nav loop: paste a backup,
            // advance through the flow, after which `SelectAccounts` cleanup
            // resets the store. Without the screen reacting to the cleared
            // envelope, the local "Pasted backup" card stayed visible and
            // tapping Next jumped to a Key screen with no envelope —
            // which then bounced straight back here, looking broken.
            vi.mocked(Clipboard.getStringAsync).mockResolvedValueOnce(
                buildSingleAccountAsbBackup(),
            )

            renderAsbImportFromOnboarding()
            await enterAsbFlow()

            // Step 1: paste a backup to set the envelope + loadedFile card.
            fireEvent.click(
                screen.getByTestId('asb_import_backup_paste_button'),
            )
            await waitForButtonEnabled('asb_import_backup_continue_button')
            // The clear (X) button only renders alongside the loaded-file
            // card, so its presence is a reliable proxy for "the card is
            // visible".
            expect(
                screen.getByTestId('asb_import_backup_clear_button'),
            ).toBeTruthy()
            expect(useAsbImportFlowStore.getState().envelope).not.toBeNull()

            // Step 2: simulate the store wipe that the rest of the flow
            // performs (SelectAccounts cleanup runs `reset()` on unmount;
            // Result screen Done also calls it). What the user actually
            // does — back-nav from Result through the stack — converges to
            // the same observable end-state on this screen.
            useAsbImportFlowStore.getState().reset()

            // Step 3: the screen has to mirror the store. The card should
            // disappear and Continue should disable so the user cannot
            // advance into a Key screen with nothing to decrypt against.
            await waitFor(() => {
                expect(
                    screen.queryByTestId('asb_import_backup_clear_button'),
                ).toBeNull()
            })
            expect(
                (
                    screen.getByTestId(
                        'asb_import_backup_continue_button',
                    ) as HTMLButtonElement
                ).disabled,
            ).toBe(true)
        },
        SLOW_TEST_TIMEOUT_MS,
    )
})

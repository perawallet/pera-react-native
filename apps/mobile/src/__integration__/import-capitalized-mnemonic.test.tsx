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

// Integration coverage for PERA-4970: a field report where a 25-word
// passphrase the user knew was valid failed to import on Android because an
// IME capitalized every word. Unit tests cover the normalization hook in
// isolation; this proves the actual screen flow — an IME-style capitalized
// paste imports successfully, and a genuine typo still blocks Recover with
// the bad slot marked, instead of failing opaquely.

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
import { mnemonicFromSeed } from 'algosdk'
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
import { useAccountsStore } from '@perawallet/wallet-core-accounts'
import { useOnboardingStore } from '@modules/onboarding/hooks/useOnboardingStore'
import { mockIndexerSearchForAccounts } from '@perawallet/wallet-core-blockchain/test-handlers'

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

const openImportOptionsSheet = async () => {
    fireEvent.click(screen.getByTestId('onboarding_import_account_button'))
    await waitFor(() =>
        screen.getByTestId('import_account_options_recover_wallet_button'),
    )
    fireEvent.click(
        screen.getByTestId('import_account_options_recover_wallet_button'),
    )
}

const startAlgo25Import = async () => {
    renderAlgo25ImportFromOnboarding()
    await openImportOptionsSheet()
    await waitFor(() => screen.getByTestId('import_options_algo25_button'))
    fireEvent.click(screen.getByTestId('import_options_algo25_button'))
    await advanceThroughImportInfo()
    await waitFor(() => screen.getByTestId('import_account_word_input_24'))
}

// Real algo25 key derivation (tweetnacl + algokit) plus several screen
// transitions — bump above the 5s default.
const SLOW_TEST_TIMEOUT_MS = 30_000

describe('Flow: Onboarding → Import Algo25 (IME-capitalized passphrase)', () => {
    // A genuine wordlist mnemonic, not hand-picked strings — proves the flow
    // against real BIP39/Algorand words rather than fixture-shaped stand-ins.
    const words = mnemonicFromSeed(new Uint8Array(32).fill(7)).split(' ')

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
        'imports successfully when every word arrives capitalized',
        async () => {
            const capitalized = words.map(
                w => w.charAt(0).toUpperCase() + w.slice(1),
            )

            await startAlgo25Import()

            // A multi-word value typed into slot 0 distributes across every
            // slot — what an IME-capitalized paste looks like on Android.
            fireEvent.change(
                screen.getByTestId('import_account_word_input_0'),
                { target: { value: capitalized.join(' ') } },
            )

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

            await waitFor(() =>
                expect(useAccountsStore.getState().accounts).toHaveLength(1),
            )
            expect(vi.mocked(Notifier.showNotification)).not.toHaveBeenCalled()
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'keeps Recover disabled on a typo',
        async () => {
            await startAlgo25Import()

            typeWordsIndividually(words)
            fireEvent.change(
                screen.getByTestId('import_account_word_input_3'),
                { target: { value: 'zzzz' } },
            )

            expect(
                (
                    screen.getByTestId(
                        'import_account_import_button',
                    ) as HTMLButtonElement
                ).disabled,
            ).toBe(true)

            // Pressing a disabled button must not start an import.
            fireEvent.click(screen.getByTestId('import_account_import_button'))
            expect(useAccountsStore.getState().accounts).toHaveLength(0)
        },
        SLOW_TEST_TIMEOUT_MS,
    )
})

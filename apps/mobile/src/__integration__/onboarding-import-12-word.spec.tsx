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

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { Notifier } from 'react-native-notifier'

import {
    chainAccountOf,
    hdIndexOf,
    useAccountsStore,
} from '@perawallet/wallet-core-accounts'
import { evmRpcHandlers } from '@perawallet/wallet-core-chain-ethereum/test-handlers'
import { mockIndexerSearchForAccounts } from '@perawallet/wallet-core-chain-algorand/test-handlers'
import { mockAccountFastLookup } from '@perawallet/wallet-core-shared/test-handlers'
import { getKeystoreStore } from '@perawallet/wallet-extension-provider'
import { resetTestKeystore } from '@test-utils/algorand-keystore-test'
import { server } from '@test-utils/msw-server'
import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import { isElementDisabled } from '@test-utils/rnw'
import { OnboardingScreen } from '@modules/onboarding/screens/OnboardingScreen/OnboardingScreen'
import { ImportAccountOptionsScreen } from '@modules/onboarding/screens/ImportAccountOptionsScreen/ImportAccountOptionsScreen'
import { ImportInfoScreen } from '@modules/onboarding/screens/ImportInfoScreen/ImportInfoScreen'
import { ImportAccountScreen } from '@modules/onboarding/screens/ImportAccountScreen/ImportAccountScreen'
import { SearchAccountsScreen } from '@modules/onboarding/screens/SearchAccountsScreen/SearchAccountsScreen'
import { ImportSelectAddressesScreen } from '@modules/onboarding/screens/ImportSelectAddressesScreen/ImportSelectAddressesScreen'
import { ImportRekeyedAddressesScreen } from '@modules/onboarding/screens/ImportRekeyedAddressesScreen/ImportRekeyedAddressesScreen'
import { NameAccountScreen } from '@modules/onboarding/screens/NameAccountScreen/NameAccountScreen'
import { useOnboardingStore } from '@modules/onboarding/hooks/useOnboardingStore'

import {
    deriveTestHDAddress,
    HD_12_ETHEREUM_ADDRESS_0,
    HD_12_ETHEREUM_ADDRESS_1,
    HD_TEST_MNEMONIC_12,
    HD_TEST_MNEMONIC_12_WORDS,
    INVALID_HD_MNEMONIC_12_WORDS,
} from './__fixtures__/onboarding'
import { SLOW_WAIT_TIMEOUT_MS } from './__fixtures__/timeouts'

// The integration setup registers whichever chains config enables.
vi.mock('@perawallet/wallet-core-config', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@perawallet/wallet-core-config')>()
    return {
        ...actual,
        config: {
            ...actual.config,
            chains: { enabled: ['algorand', 'ethereum'], capabilities: {} },
        },
        // Ethereum is read from its node alone, whatever a local .env lists.
        peraServicesFor: (
            scope: Parameters<typeof actual.peraServicesFor>[0],
        ) =>
            scope.chainId === 'ethereum'
                ? (new Set() as ReturnType<typeof actual.peraServicesFor>)
                : actual.peraServicesFor(scope),
        chainEndpointsFor: (
            chainId: Parameters<typeof actual.chainEndpointsFor>[0],
        ) =>
            chainId === 'ethereum'
                ? {
                      mainnet: ['https://ethereum.rpc.test/'],
                      sepolia: ['https://ethereum.rpc.test/'],
                  }
                : actual.chainEndpointsFor(chainId),
    }
})

const ETHEREUM_RPC_URL = 'https://ethereum.rpc.test/'

const renderImport = () =>
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

const enterTwelveWordSeed = async (words: string[]) => {
    renderImport()
    fireEvent.click(screen.getByTestId('onboarding_import_account_button'))
    await waitFor(() =>
        screen.getByTestId('import_account_options_recover_wallet_button'),
    )
    fireEvent.click(
        screen.getByTestId('import_account_options_recover_wallet_button'),
    )
    await waitFor(() => screen.getByTestId('import_options_twelve_word_button'))
    fireEvent.click(screen.getByTestId('import_options_twelve_word_button'))
    await waitFor(() => screen.getByTestId('import_info_recover_button'))
    fireEvent.click(screen.getByTestId('import_info_recover_button'))
    await waitFor(() => screen.getByTestId('import_account_word_input_0'))
    words.forEach((word, idx) => {
        fireEvent.change(
            screen.getByTestId(`import_account_word_input_${idx}`),
            { target: { value: word } },
        )
    })
    await waitFor(() =>
        expect(
            isElementDisabled(
                screen.getByTestId('import_account_import_button'),
            ),
        ).toBe(false),
    )
}

describe('Flow: Onboarding → Import a 12-word seed', () => {
    beforeEach(() => {
        resetTestKeystore()
        useAccountsStore.getState().setAccounts([])
        useOnboardingStore.getState().reset()
        vi.mocked(Notifier.showNotification).mockClear()
    })

    it("Given a 12-word seed used on Ethereum at its first two addresses, when the user imports it and keeps the selection, then Universal Wallet accounts hold Algorand and Ethereum at MetaMask's addresses, in order", async () => {
        const algorandAddress0 = await deriveTestHDAddress(
            0,
            0,
            HD_TEST_MNEMONIC_12,
        )
        const algorandAddress1 = await deriveTestHDAddress(
            0,
            1,
            HD_TEST_MNEMONIC_12,
        )
        server.use(
            mockAccountFastLookup({
                address: ':any',
                response: { account_exists: false },
            }),
            mockIndexerSearchForAccounts(),
            ...evmRpcHandlers({
                rpcUrl: ETHEREUM_RPC_URL,
                responses: {
                    eth_getTransactionCount: params =>
                        [
                            HD_12_ETHEREUM_ADDRESS_0,
                            HD_12_ETHEREUM_ADDRESS_1,
                        ].some(
                            address =>
                                address.toLowerCase() ===
                                String(params[0]).toLowerCase(),
                        )
                            ? '0x2'
                            : '0x0',
                },
            }),
        )

        await enterTwelveWordSeed(HD_TEST_MNEMONIC_12_WORDS)
        expect(screen.queryByTestId('import_account_word_input_12')).toBeNull()
        fireEvent.click(screen.getByTestId('import_account_import_button'))

        await waitFor(
            () =>
                expect(
                    screen.getByTestId(
                        'import_select_addresses_continue_button',
                    ),
                ).toBeTruthy(),
            { timeout: SLOW_WAIT_TIMEOUT_MS },
        )
        const first = screen.getByTestId(
            `import_select_addresses_address_${HD_12_ETHEREUM_ADDRESS_0}`,
        )
        const second = screen.getByTestId(
            `import_select_addresses_address_${HD_12_ETHEREUM_ADDRESS_1}`,
        )
        expect(
            first.compareDocumentPosition(second) &
                Node.DOCUMENT_POSITION_FOLLOWING,
        ).toBeTruthy()

        fireEvent.click(
            screen.getByTestId('import_select_addresses_continue_button'),
        )
        await waitFor(
            () => expect(useAccountsStore.getState().accounts).toHaveLength(2),
            { timeout: SLOW_WAIT_TIMEOUT_MS },
        )

        const [account0, account1] = useAccountsStore
            .getState()
            .accounts.toSorted(
                (a, b) => hdIndexOf(a)!.keyIndex - hdIndexOf(b)!.keyIndex,
            )
        expect(account0.custody).toMatchObject({ kind: 'local', seed: 'bip39' })
        expect(hdIndexOf(account0)).toEqual({ account: 0, keyIndex: 0 })
        expect(hdIndexOf(account1)).toEqual({ account: 0, keyIndex: 1 })
        expect(chainAccountOf(account0, 'algorand')?.address).toBe(
            algorandAddress0,
        )
        expect(chainAccountOf(account1, 'algorand')?.address).toBe(
            algorandAddress1,
        )
        expect(chainAccountOf(account0, 'ethereum')?.address).toBe(
            HD_12_ETHEREUM_ADDRESS_0,
        )
        expect(chainAccountOf(account1, 'ethereum')?.address).toBe(
            HD_12_ETHEREUM_ADDRESS_1,
        )
    })

    it('Given 12 words whose checksum is wrong, when the user taps Recover, then an error toast is raised and nothing is created', async () => {
        server.use(
            mockAccountFastLookup({
                address: ':any',
                response: { account_exists: false },
            }),
            mockIndexerSearchForAccounts(),
        )

        await enterTwelveWordSeed(INVALID_HD_MNEMONIC_12_WORDS)
        fireEvent.click(screen.getByTestId('import_account_import_button'))

        await waitFor(
            () =>
                expect(
                    vi.mocked(Notifier.showNotification),
                ).toHaveBeenCalledWith(
                    expect.objectContaining({
                        title: 'onboarding.import_account.failed_title',
                    }),
                ),
            { timeout: SLOW_WAIT_TIMEOUT_MS },
        )
        expect(useAccountsStore.getState().accounts).toHaveLength(0)
        expect(getKeystoreStore().state.keys).toHaveLength(0)
        expect(
            screen.queryByTestId('import_select_addresses_continue_button'),
        ).toBeNull()
    })

    it('Given the wallet is already in Pera, when the user imports its 12-word seed again, then nothing new is offered, going on to the wallet adds nothing', async () => {
        const algorandAddress0 = await deriveTestHDAddress(
            0,
            0,
            HD_TEST_MNEMONIC_12,
        )
        useAccountsStore.getState().setAccounts([
            {
                id: 'existing-1',
                name: '',
                custody: {
                    kind: 'local',
                    seed: 'bip39',
                    hd: { account: 0, keyIndex: 0 },
                },
                chains: {
                    algorand: {
                        address: algorandAddress0,
                        keyPairId: 'pre-seeded',
                    },
                },
            },
        ])
        server.use(
            mockAccountFastLookup({
                address: algorandAddress0,
                response: { account_exists: true },
            }),
            mockAccountFastLookup({
                address: ':any',
                response: { account_exists: false },
            }),
            mockIndexerSearchForAccounts(),
            ...evmRpcHandlers({
                rpcUrl: ETHEREUM_RPC_URL,
                responses: { eth_getTransactionCount: () => '0x0' },
            }),
        )

        await enterTwelveWordSeed(HD_TEST_MNEMONIC_12_WORDS)
        fireEvent.click(screen.getByTestId('import_account_import_button'))

        await waitFor(
            () =>
                expect(
                    screen.getByTestId(
                        'import_select_addresses_continue_button',
                    ),
                ).toBeTruthy(),
            { timeout: SLOW_WAIT_TIMEOUT_MS },
        )
        // Nothing new to pick: no row is selectable, and the only way on is
        // to go to the wallet.
        expect(
            document.querySelector(
                '[data-testid^="import_select_addresses_item_"]',
            ),
        ).toBeNull()
        expect(
            screen.getByText('onboarding.import_select_addresses.go_to_wallet'),
        ).toBeTruthy()

        fireEvent.click(
            screen.getByTestId('import_select_addresses_continue_button'),
        )
        await waitFor(
            () =>
                expect(useOnboardingStore.getState().isOnboarding).toBe(false),
            { timeout: SLOW_WAIT_TIMEOUT_MS },
        )
        expect(useAccountsStore.getState().accounts).toHaveLength(1)
    })
})

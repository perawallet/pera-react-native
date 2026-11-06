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
import { fireEvent, renderHook, screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'

import {
    chainAccountOf,
    hdIndexOf,
    useAccountsStore,
} from '@perawallet/wallet-core-accounts'
import { evmRpcHandlers } from '@perawallet/wallet-core-chain-ethereum/test-handlers'
import { mockIndexerSearchForAccounts } from '@perawallet/wallet-core-chain-algorand/test-handlers'
import { useRequiresMnemonicBackup } from '@perawallet/wallet-core-backup'
import { kmsCore } from '@perawallet/wallet-core-kms'
import { mockAccountFastLookup } from '@perawallet/wallet-core-shared/test-handlers'
import { resetTestKeystore } from '@test-utils/algorand-keystore-test'
import { server } from '@test-utils/msw-server'
import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import { closestPressable, isElementDisabled } from '@test-utils/rnw'
import { OnboardingScreen } from '@modules/onboarding/screens/OnboardingScreen/OnboardingScreen'
import { ImportAccountOptionsScreen } from '@modules/onboarding/screens/ImportAccountOptionsScreen/ImportAccountOptionsScreen'
import { ImportInfoScreen } from '@modules/onboarding/screens/ImportInfoScreen/ImportInfoScreen'
import { ImportAccountScreen } from '@modules/onboarding/screens/ImportAccountScreen/ImportAccountScreen'
import { SearchAccountsScreen } from '@modules/onboarding/screens/SearchAccountsScreen/SearchAccountsScreen'
import { ImportSelectAddressesScreen } from '@modules/onboarding/screens/ImportSelectAddressesScreen/ImportSelectAddressesScreen'
import { ImportRekeyedAddressesScreen } from '@modules/onboarding/screens/ImportRekeyedAddressesScreen/ImportRekeyedAddressesScreen'
import { NameAccountScreen } from '@modules/onboarding/screens/NameAccountScreen/NameAccountScreen'
import { useOnboardingStore } from '@modules/onboarding/hooks/useOnboardingStore'

import { ethereumAddressAt } from './__fixtures__/hd-addresses'
import {
    HD_TEST_ADDRESS,
    HD_TEST_MNEMONIC_24_WORDS,
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
        // Ethereum is read from its node alone, whatever a local .env lists:
        // the chain context takes its services from here.
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

// The node the config mock above hands Ethereum.
const ETHEREUM_RPC_URL = 'https://ethereum.rpc.test/'

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

const reachSelection = async () => {
    renderHDImportFromOnboarding()
    fireEvent.click(screen.getByTestId('onboarding_import_account_button'))
    await waitFor(() =>
        screen.getByTestId('import_account_options_recover_wallet_button'),
    )
    fireEvent.click(
        screen.getByTestId('import_account_options_recover_wallet_button'),
    )
    await waitFor(() => screen.getByTestId('import_options_hd_wallet_button'))
    fireEvent.click(screen.getByTestId('import_options_hd_wallet_button'))
    await waitFor(() => screen.getByTestId('import_info_recover_button'))
    fireEvent.click(screen.getByTestId('import_info_recover_button'))
    await waitFor(() => screen.getByTestId('import_account_word_input_0'))
    HD_TEST_MNEMONIC_24_WORDS.forEach((word, idx) => {
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
    fireEvent.click(screen.getByTestId('import_account_import_button'))
    await waitFor(
        () =>
            expect(
                screen.getByTestId('import_select_addresses_continue_button'),
            ).toBeTruthy(),
        { timeout: SLOW_WAIT_TIMEOUT_MS },
    )
}

const importMnemonic = async ({
    onlyAddress,
    onAddressesListed,
}: {
    /** Import this account alone instead of every preselected one. */
    onlyAddress?: string
    onAddressesListed?: () => void
} = {}) => {
    await reachSelection()
    onAddressesListed?.()
    if (onlyAddress) {
        // Every new account starts selected: clear them, then pick one. The
        // row, not its checkbox, since a jsdom click on the checkbox also
        // bubbles to the row and toggles twice.
        fireEvent.click(
            screen.getByTestId('import_select_addresses_select_all_checkbox'),
        )
        fireEvent.click(
            closestPressable(
                screen.getByTestId(
                    `import_select_addresses_item_checkbox_${onlyAddress}`,
                ),
            )!,
        )
    }
    fireEvent.click(
        screen.getByTestId('import_select_addresses_continue_button'),
    )
    // More than one imported account skips the naming step.
    if (onlyAddress) {
        await waitFor(() => screen.getByTestId('name_account_finish_button'))
        fireEvent.click(screen.getByTestId('name_account_finish_button'))
    }
    await waitFor(
        () => expect(useOnboardingStore.getState().isOnboarding).toBe(false),
        { timeout: SLOW_WAIT_TIMEOUT_MS },
    )
}

describe('Flow: Import HD wallet → discover the other chains it was used on', () => {
    beforeEach(() => {
        resetTestKeystore()
        useAccountsStore.getState().setAccounts([])
        useOnboardingStore.getState().reset()
    })

    const serveSeedActivity = (ethereumOnlyAddress: string) =>
        server.use(
            mockAccountFastLookup({
                address: HD_TEST_ADDRESS,
                response: { account_exists: true },
            }),
            mockAccountFastLookup({
                address: ':any',
                response: { account_exists: false },
            }),
            mockIndexerSearchForAccounts(),
            ...evmRpcHandlers({
                rpcUrl: ETHEREUM_RPC_URL,
                responses: {
                    eth_getTransactionCount: params =>
                        String(params[0]).toLowerCase() ===
                        ethereumOnlyAddress.toLowerCase()
                            ? '0x2'
                            : '0x0',
                },
            }),
        )

    it('Given a seed used on Algorand at its first address and on Ethereum alone at a later account, when the user imports only the first account, then that later account is listed but not added, and nothing past the gap', async () => {
        const ethereumOnlyAddress = await ethereumAddressAt(2, 0)
        serveSeedActivity(ethereumOnlyAddress)
        const walk = vi.spyOn(
            useAccountsStore.getState(),
            'discoverWalletAccounts',
        )

        await importMnemonic({
            onlyAddress: HD_TEST_ADDRESS,
            onAddressesListed: () =>
                expect(
                    screen.getByTestId(
                        `import_select_addresses_address_${ethereumOnlyAddress}`,
                    ),
                ).toBeTruthy(),
        })

        await waitFor(() => expect(walk).toHaveBeenCalledOnce())
        await walk.mock.results[0].value
        const accounts = useAccountsStore.getState().accounts
        expect(accounts).toHaveLength(1)
        expect(hdIndexOf(accounts[0])).toEqual({ account: 0, keyIndex: 0 })
        expect(chainAccountOf(accounts[0], 'algorand')?.address).toBe(
            HD_TEST_ADDRESS,
        )
    })

    it('Given Ethereum is unreachable, when the user imports the seed, then the selection lists the Algorand account and says Ethereum could not be checked', async () => {
        server.use(
            mockAccountFastLookup({
                address: HD_TEST_ADDRESS,
                response: { account_exists: true },
            }),
            mockAccountFastLookup({
                address: ':any',
                response: { account_exists: false },
            }),
            mockIndexerSearchForAccounts(),
            http.post(ETHEREUM_RPC_URL, () => HttpResponse.error()),
        )

        await importMnemonic({
            onlyAddress: HD_TEST_ADDRESS,
            onAddressesListed: () => {
                expect(
                    screen.getByTestId(
                        'import_select_addresses_unchecked_networks',
                    ),
                ).toBeTruthy()
                expect(
                    screen.getByTestId(
                        `import_select_addresses_address_${HD_TEST_ADDRESS}`,
                    ),
                ).toBeTruthy()
            },
        })
    })

    it('Given Ethereum was unreachable during the search, when the user checks it again once it answers, then the account used on Ethereum alone is listed and nothing is left unchecked', async () => {
        const ethereumOnlyAddress = await ethereumAddressAt(2, 0)
        server.use(
            mockAccountFastLookup({
                address: HD_TEST_ADDRESS,
                response: { account_exists: true },
            }),
            mockAccountFastLookup({
                address: ':any',
                response: { account_exists: false },
            }),
            mockIndexerSearchForAccounts(),
            http.post(ETHEREUM_RPC_URL, () => HttpResponse.error()),
        )
        await reachSelection()
        expect(
            screen.getByTestId('import_select_addresses_unchecked_networks'),
        ).toBeTruthy()
        expect(
            screen.queryByTestId(
                `import_select_addresses_address_${ethereumOnlyAddress}`,
            ),
        ).toBeNull()

        // Handlers added later win, so Ethereum answers from here on.
        serveSeedActivity(ethereumOnlyAddress)
        fireEvent.click(
            screen.getByTestId('import_select_addresses_retry_networks_button'),
        )

        await waitFor(
            () =>
                expect(
                    screen.getByTestId(
                        `import_select_addresses_address_${ethereumOnlyAddress}`,
                    ),
                ).toBeTruthy(),
            { timeout: SLOW_WAIT_TIMEOUT_MS },
        )
        expect(
            screen.queryByTestId('import_select_addresses_unchecked_networks'),
        ).toBeNull()
    })

    it('Given Ethereum was unreachable during the search, when checking again reaches no network at all, then the account found before is still listed and the networks can be checked again', async () => {
        server.use(
            mockAccountFastLookup({
                address: HD_TEST_ADDRESS,
                response: { account_exists: true },
            }),
            mockAccountFastLookup({
                address: ':any',
                response: { account_exists: false },
            }),
            mockIndexerSearchForAccounts(),
            http.post(ETHEREUM_RPC_URL, () => HttpResponse.error()),
        )
        await reachSelection()

        // Every lookup fails from here on.
        server.use(
            mockAccountFastLookup({
                address: ':any',
                response: {},
                status: 500,
            }),
        )
        fireEvent.click(
            screen.getByTestId('import_select_addresses_retry_networks_button'),
        )

        await waitFor(
            () =>
                expect(
                    screen.getByTestId(
                        `import_select_addresses_address_${HD_TEST_ADDRESS}`,
                    ),
                ).toBeTruthy(),
            { timeout: SLOW_WAIT_TIMEOUT_MS },
        )
        expect(
            screen.getByTestId('import_select_addresses_unchecked_networks'),
        ).toBeTruthy()
        expect(
            screen.getByTestId('import_select_addresses_retry_networks_button'),
        ).toBeTruthy()
    })

    it('Given Algorand was unreachable during the search, when the user imports every account, then no imported account asks to back up the passphrase', async () => {
        const ethereumOnlyAddress = await ethereumAddressAt(2, 0)
        serveSeedActivity(ethereumOnlyAddress)
        server.use(
            mockAccountFastLookup({
                address: ':any',
                response: {},
                status: 500,
            }),
        )

        await importMnemonic()

        const { accounts } = useAccountsStore.getState()
        expect(accounts.length).toBeGreaterThan(0)
        for (const account of accounts) {
            const { result } = renderHook(() =>
                useRequiresMnemonicBackup(account, 'algorand'),
            )
            expect(result.current).toBe(false)
        }
    })

    it('Given a seed used on Ethereum alone at a later account, when the user keeps every preselected account, then that account is stored holding Algorand and Ethereum with its Ethereum key in the keystore', async () => {
        const ethereumOnlyAddress = await ethereumAddressAt(2, 0)
        serveSeedActivity(ethereumOnlyAddress)

        await importMnemonic()

        await waitFor(
            () => expect(useAccountsStore.getState().accounts).toHaveLength(2),
            { timeout: SLOW_WAIT_TIMEOUT_MS },
        )
        const discovered = useAccountsStore
            .getState()
            .accounts.find(account => hdIndexOf(account)?.account === 2)
        expect(hdIndexOf(discovered!)).toEqual({ account: 2, keyIndex: 0 })
        expect(Object.keys(discovered!.chains).sort()).toEqual([
            'algorand',
            'ethereum',
        ])
        const ethereumEntry = chainAccountOf(discovered!, 'ethereum')
        expect(ethereumEntry?.address).toBe(ethereumOnlyAddress)
        expect(await kmsCore.getKey(ethereumEntry!.keyPairId!)).toBeTruthy()
    })
})

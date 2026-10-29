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

import {
    chainAccountOf,
    hdIndexOf,
    useAccountsStore,
} from '@perawallet/wallet-core-accounts'
import { evmRpcHandlers } from '@perawallet/wallet-core-chain-ethereum/test-handlers'
import { mockIndexerSearchForAccounts } from '@perawallet/wallet-core-chain-algorand/test-handlers'
import { mockAccountFastLookup } from '@perawallet/wallet-core-shared/test-handlers'
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
        chainEndpointsFor: (
            chainId: Parameters<typeof actual.chainEndpointsFor>[0],
        ) =>
            chainId === 'ethereum'
                ? {
                      mainnet: 'https://ethereum.rpc.test/',
                      sepolia: 'https://ethereum.rpc.test/',
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

const importMnemonic = async ({
    isSelectingAll = false,
    onAddressesListed,
}: {
    isSelectingAll?: boolean
    onAddressesListed?: () => void
} = {}) => {
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
    onAddressesListed?.()
    if (isSelectingAll) {
        fireEvent.click(
            screen.getByTestId('import_select_addresses_select_all_checkbox'),
        )
    }
    fireEvent.click(
        screen.getByTestId('import_select_addresses_continue_button'),
    )
    // More than one imported account skips the naming step.
    if (!isSelectingAll) {
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

    it('Given a seed used on Algorand at its first address and on Ethereum alone at a later account, when the user imports it keeping the selection, then that later account is listed but not added, and nothing past the gap', async () => {
        const ethereumOnlyAddress = await ethereumAddressAt(2, 0)
        serveSeedActivity(ethereumOnlyAddress)
        const walk = vi.spyOn(
            useAccountsStore.getState(),
            'discoverWalletAccounts',
        )

        await importMnemonic({
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

    it('Given a seed used on Ethereum alone at a later account, when the user selects every listed account, then that account is stored holding Algorand and Ethereum with its Ethereum key in the keystore', async () => {
        const ethereumOnlyAddress = await ethereumAddressAt(2, 0)
        serveSeedActivity(ethereumOnlyAddress)

        await importMnemonic({ isSelectingAll: true })

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

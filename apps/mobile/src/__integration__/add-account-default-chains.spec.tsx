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

import React, { Children, isValidElement } from 'react'
import {
    afterAll,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest'
import { fireEvent, renderHook, screen, waitFor } from '@testing-library/react'
import { http, type RequestHandler } from 'msw'

import {
    chainAccountOf,
    useAccountsStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import {
    EVM_CHAIN_NETWORKS,
    keyDerivations,
    type ChainId,
    type EvmChainId,
} from '@perawallet/wallet-core-chain-contract'
import { kmsCore, useKMS } from '@perawallet/wallet-core-kms'
import { mockIndexerSearchForAccounts } from '@perawallet/wallet-core-chain-algorand/test-handlers'
import { evmRpcHandlers } from '@perawallet/wallet-core-chain-ethereum/test-handlers'
import { mockAccountFastLookup } from '@perawallet/wallet-core-shared/test-handlers'
import { resetTestKeystore } from '@test-utils/algorand-keystore-test'
import {
    resetTestDatabase,
    setupTestDatabase,
    teardownTestDatabase,
} from '@test-utils/database-setup'
import { server } from '@test-utils/msw-server'
import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import { isElementDisabled } from '@test-utils/rnw'
import { useOnboardingStore } from '@modules/onboarding/hooks/useOnboardingStore'
import { AddAccountStackNavigator } from '@modules/onboarding/routes/add-account'
import { OnboardingStackNavigator } from '@modules/onboarding/routes'
import { AddAccountScreen } from '@modules/onboarding/screens/AddAccountScreen/AddAccountScreen'
import { ImportAccountOptionsScreen } from '@modules/onboarding/screens/ImportAccountOptionsScreen/ImportAccountOptionsScreen'
import { ImportAccountScreen } from '@modules/onboarding/screens/ImportAccountScreen/ImportAccountScreen'
import { ImportInfoScreen } from '@modules/onboarding/screens/ImportInfoScreen/ImportInfoScreen'
import { ImportPrivateKeyScreen } from '@modules/onboarding/screens/ImportPrivateKeyScreen/ImportPrivateKeyScreen'
import { ImportRekeyedAddressesScreen } from '@modules/onboarding/screens/ImportRekeyedAddressesScreen/ImportRekeyedAddressesScreen'
import { ImportSelectAddressesScreen } from '@modules/onboarding/screens/ImportSelectAddressesScreen/ImportSelectAddressesScreen'
import { NameAccountScreen } from '@modules/onboarding/screens/NameAccountScreen/NameAccountScreen'
import { OnboardingScreen } from '@modules/onboarding/screens/OnboardingScreen/OnboardingScreen'
import { SearchAccountsScreen } from '@modules/onboarding/screens/SearchAccountsScreen/SearchAccountsScreen'
import { WatchAccountScreen } from '@modules/onboarding/screens/WatchAccountScreen/WatchAccountScreen'

import {
    HD_TEST_ADDRESS,
    HD_TEST_MNEMONIC_24_INDICES,
    HD_TEST_MNEMONIC_24_WORDS,
} from './__fixtures__/onboarding'
import { SLOW_WAIT_TIMEOUT_MS } from './__fixtures__/timeouts'

const EVM_CHAINS = Object.keys(EVM_CHAIN_NETWORKS) as EvmChainId[]

// Every EVM chain is registered with its own node, so discovery can tell
// which of them an address is active on.
vi.mock('@perawallet/wallet-core-config', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@perawallet/wallet-core-config')>()
    const { EVM_CHAIN_NETWORKS: networks } = await vi.importActual<
        typeof import('@perawallet/wallet-core-chain-contract')
    >('@perawallet/wallet-core-chain-contract')
    return {
        ...actual,
        config: {
            ...actual.config,
            chains: {
                enabled: ['algorand', ...Object.keys(networks)],
                capabilities: {},
            },
        },
        chainEndpointsFor: (
            chainId: Parameters<typeof actual.chainEndpointsFor>[0],
        ) =>
            chainId in networks
                ? Object.fromEntries(
                      networks[chainId as keyof typeof networks].networks.map(
                          ({ id }) => [id, `https://${chainId}.rpc.test/`],
                      ),
                  )
                : actual.chainEndpointsFor(chainId),
    }
})

// Hardhat's first development account: a published test key.
const TEST_PRIVATE_KEY =
    'ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'
const TEST_PRIVATE_KEY_ADDRESS = '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266'
const WATCH_ADDRESS = '0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed'

/** `activeAddress` narrows the activity to that one address, as a seed's walk needs a gap to end. */
const handlersFor = (
    activeChains: readonly ChainId[],
    activeAddress?: string,
): RequestHandler[] =>
    EVM_CHAINS.flatMap(chainId => {
        const url = `https://${chainId}.rpc.test/`
        const [mainnet] = EVM_CHAIN_NETWORKS[chainId].networks
        return [
            http.post(url, () => undefined),
            ...evmRpcHandlers({
                rpcUrl: url,
                responses: {
                    eth_chainId: `0x${mainnet!.eip155ChainId.toString(16)}`,
                    eth_getTransactionCount: params =>
                        activeChains.includes(chainId) &&
                        (activeAddress === undefined ||
                            String(params[0]).toLowerCase() ===
                                activeAddress.toLowerCase())
                            ? '0x1'
                            : '0x0',
                },
            }),
        ]
    })

// The seed's Ethereum address at its first index, read through a throwaway
// copy of the seed: secp256k1 keys derive only inside the keystore.
const firstHdEthereumAddress = async (): Promise<string> => {
    const { result: kms } = renderHook(() => useKMS())
    const rootKey = await waitFor(async () => {
        const created = await kms.current.createHDWalletKey({
            mnemonicIndices: HD_TEST_MNEMONIC_24_INDICES,
        })
        expect(created).not.toBeNull()
        return created!
    })
    const { address } = await keyDerivations
        .get('ethereum')
        .deriveAccount(kmsCore, rootKey.seedKey.id, 0, 0, {
            scheme: 'secp256k1',
            networkId: 'mainnet',
        })
    resetTestKeystore()
    return address
}

const nameAccountScreen = { name: 'NameAccount', component: NameAccountScreen }
const importPrivateKeyScreen = {
    name: 'ImportPrivateKey',
    component: ImportPrivateKeyScreen,
}
const importAccountOptionsScreen = {
    name: 'ImportAccountOptions',
    component: ImportAccountOptionsScreen,
}

const screenNamesIn = (node: React.ReactNode): string[] =>
    Children.toArray(node).flatMap(child => {
        if (!isValidElement(child)) return []
        const props = child.props as {
            name?: string
            children?: React.ReactNode
        }
        return props.name ? [props.name] : screenNamesIn(props.children)
    })

// The harness swaps in an in-memory navigator, so read the registered screens
// off the element tree each stack navigator returns.
const routeNamesOf = (Navigator: () => React.ReactElement): string[] => {
    const { result } = renderHook(() => Navigator())
    return screenNamesIn(
        (result.current.props as { children: React.ReactNode }).children,
    )
}

const theOnlyAccount = (): WalletAccount => {
    const { accounts } = useAccountsStore.getState()
    expect(accounts).toHaveLength(1)
    return accounts[0]!
}

const finishNaming = async (): Promise<void> => {
    await waitFor(() => screen.getByTestId('name_account_finish_button'), {
        timeout: SLOW_WAIT_TIMEOUT_MS,
    })
    fireEvent.click(screen.getByTestId('name_account_finish_button'))
}

const importKeyThroughOptions = async (): Promise<void> => {
    fireEvent.click(
        await waitFor(() =>
            screen.getByTestId('import_account_options_private_key_button'),
        ),
    )
    const input = await waitFor(() =>
        screen.getByTestId('import_private_key_input'),
    )
    fireEvent.change(input, { target: { value: TEST_PRIVATE_KEY } })
    await waitFor(() =>
        expect(
            isElementDisabled(
                screen.getByTestId('import_private_key_submit_button'),
            ),
        ).toBe(false),
    )
    fireEvent.click(screen.getByTestId('import_private_key_submit_button'))
}

const expectImportedKeyOnEthereumAlone = async (): Promise<void> => {
    await finishNaming()
    await waitFor(() =>
        expect(useAccountsStore.getState().accounts[0]?.name).toBeDefined(),
    )
    const account = theOnlyAccount()
    expect(Object.keys(account.chains)).toEqual(['ethereum'])
    expect(chainAccountOf(account, 'ethereum')?.address.toLowerCase()).toBe(
        TEST_PRIVATE_KEY_ADDRESS,
    )
}

describe('Flow: adding an account lands it on its default chains', () => {
    beforeAll(async () => {
        await setupTestDatabase()
    })

    afterAll(async () => {
        await teardownTestDatabase()
    })

    beforeEach(async () => {
        await resetTestDatabase()
        resetTestKeystore()
        useAccountsStore.getState().setAccounts([])
        useOnboardingStore.getState().reset()
        server.use(
            ...handlersFor([]),
            mockAccountFastLookup({
                address: ':any',
                response: { account_exists: false },
            }),
            mockIndexerSearchForAccounts(),
        )
    })

    it('Given Ethereum is registered, when the user creates a wallet, then one account holds Algorand and Ethereum, both shown while naming it', async () => {
        renderWithNavigation(OnboardingScreen, 'Onboarding', {
            additionalScreens: [nameAccountScreen],
        })

        fireEvent.click(screen.getByTestId('onboarding_create_wallet_button'))

        await waitFor(() => screen.getByTestId('name_account_chain_icons'), {
            timeout: SLOW_WAIT_TIMEOUT_MS,
        })
        expect(screen.getByTestId('chain_icon_algorand')).toBeTruthy()
        expect(screen.getByTestId('chain_icon_ethereum')).toBeTruthy()
        expect(screen.queryByTestId('chain_icon_base')).toBeNull()
        await finishNaming()

        await waitFor(() =>
            expect(useAccountsStore.getState().accounts).toHaveLength(1),
        )
        const account = theOnlyAccount()
        expect(Object.keys(account.chains)).toEqual(['algorand', 'ethereum'])
        expect(chainAccountOf(account, 'algorand')?.enabledBy).toBe('created')
        expect(chainAccountOf(account, 'ethereum')?.enabledBy).toBe('created')
    })

    it('Given a recovery phrase active on Ethereum and Base, when it is imported, then one account holds Algorand and Ethereum, and Base joins through discovery', async () => {
        server.use(
            ...handlersFor(
                ['ethereum', 'base'],
                await firstHdEthereumAddress(),
            ),
        )
        renderWithNavigation(OnboardingScreen, 'Onboarding', {
            additionalScreens: [
                importAccountOptionsScreen,
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
                nameAccountScreen,
            ],
        })

        fireEvent.click(screen.getByTestId('onboarding_import_account_button'))
        fireEvent.click(
            await waitFor(() =>
                screen.getByTestId(
                    'import_account_options_recover_wallet_button',
                ),
            ),
        )
        fireEvent.click(
            await waitFor(() =>
                screen.getByTestId('import_options_hd_wallet_button'),
            ),
        )
        fireEvent.click(
            await waitFor(() =>
                screen.getByTestId('import_info_recover_button'),
            ),
        )
        await waitFor(() => screen.getByTestId('import_account_word_input_0'))
        HD_TEST_MNEMONIC_24_WORDS.forEach((word, index) => {
            fireEvent.change(
                screen.getByTestId(`import_account_word_input_${index}`),
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
        fireEvent.click(
            await waitFor(
                () =>
                    screen.getByTestId(
                        'import_select_addresses_continue_button',
                    ),
                { timeout: SLOW_WAIT_TIMEOUT_MS },
            ),
        )

        await waitFor(
            () =>
                expect(
                    chainAccountOf(
                        useAccountsStore.getState().accounts[0]!,
                        'base',
                    )?.enabledBy,
                ).toBe('discovery'),
            { timeout: SLOW_WAIT_TIMEOUT_MS },
        )
        await finishNaming()
        await waitFor(() =>
            expect(useOnboardingStore.getState().isOnboarding).toBe(false),
        )

        const account = theOnlyAccount()
        expect(chainAccountOf(account, 'algorand')?.address).toBe(
            HD_TEST_ADDRESS,
        )
        expect(chainAccountOf(account, 'ethereum')?.enabledBy).toBe('created')
        expect(chainAccountOf(account, 'base')?.enabledBy).toBe('discovery')
        expect(Object.keys(account.chains).sort()).toEqual(
            ['algorand', 'base', 'ethereum'].sort(),
        )
    })

    it('Given private keys are on for Ethereum, then both the onboarding and the add-account stacks register the private-key import', () => {
        expect(routeNamesOf(OnboardingStackNavigator)).toContain(
            'ImportPrivateKey',
        )
        expect(routeNamesOf(AddAccountStackNavigator)).toContain(
            'ImportPrivateKey',
        )
    })

    it('Given a key with no activity, when it is imported from first-run onboarding, then one account holds Ethereum alone, and importing it again adds nothing', async () => {
        const renderFromOnboarding = () =>
            renderWithNavigation(OnboardingScreen, 'Onboarding', {
                additionalScreens: [
                    importAccountOptionsScreen,
                    importPrivateKeyScreen,
                    nameAccountScreen,
                ],
            })

        const first = renderFromOnboarding()
        fireEvent.click(screen.getByTestId('onboarding_import_account_button'))
        await importKeyThroughOptions()
        await expectImportedKeyOnEthereumAlone()
        const imported = theOnlyAccount()
        first.unmount()

        renderFromOnboarding()
        fireEvent.click(screen.getByTestId('onboarding_import_account_button'))
        await importKeyThroughOptions()

        await waitFor(() =>
            expect(
                isElementDisabled(
                    screen.getByTestId('import_private_key_submit_button'),
                ),
            ).toBe(true),
        )
        expect(screen.queryByTestId('name_account_finish_button')).toBeNull()
        expect(useAccountsStore.getState().accounts).toEqual([imported])
    })

    it('Given a key active only on Polygon, when it is imported, then the account holds Polygon alone and is named from its Polygon address', async () => {
        server.use(...handlersFor(['polygon']))
        renderWithNavigation(
            ImportAccountOptionsScreen,
            'ImportAccountOptions',
            {
                additionalScreens: [importPrivateKeyScreen, nameAccountScreen],
            },
        )

        await importKeyThroughOptions()

        const nameInput = await waitFor(
            () => screen.getByTestId('name_account_name_input'),
            { timeout: SLOW_WAIT_TIMEOUT_MS },
        )
        expect((nameInput as HTMLInputElement).value).not.toBe(
            'No Address Found',
        )
        expect((nameInput as HTMLInputElement).value.toLowerCase()).toContain(
            TEST_PRIVATE_KEY_ADDRESS.slice(2, 6),
        )
        const account = theOnlyAccount()
        expect(Object.keys(account.chains)).toEqual(['polygon'])
        expect(chainAccountOf(account, 'polygon')?.enabledBy).toBe('discovery')
    })

    it('Given a key with no activity, when it is imported from add-account, then one account holds Ethereum alone', async () => {
        renderWithNavigation(AddAccountScreen, 'AddAccountHome', {
            additionalScreens: [
                importAccountOptionsScreen,
                importPrivateKeyScreen,
                nameAccountScreen,
            ],
        })

        fireEvent.click(
            await waitFor(() =>
                screen.getByTestId('add_account_import_button'),
            ),
        )
        await importKeyThroughOptions()

        await expectImportedKeyOnEthereumAlone()
    })

    it('Given an 0x address with no activity, when it is watched, then the account is on Ethereum alone and never on Algorand', async () => {
        renderWithNavigation(WatchAccountScreen, 'WatchAccount', {
            additionalScreens: [nameAccountScreen],
        })

        fireEvent.change(
            await waitFor(() =>
                screen.getByTestId('watch_account_address_input'),
            ),
            { target: { value: WATCH_ADDRESS } },
        )
        await waitFor(() =>
            expect(
                isElementDisabled(
                    screen.getByTestId('watch_account_submit_button'),
                ),
            ).toBe(false),
        )
        fireEvent.click(screen.getByTestId('watch_account_submit_button'))
        await finishNaming()

        await waitFor(() =>
            expect(useAccountsStore.getState().accounts).toHaveLength(1),
        )
        const account = theOnlyAccount()
        expect(account.custody).toEqual({ kind: 'watch' })
        expect(Object.keys(account.chains)).toEqual(['ethereum'])
    })
})

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

// The notifications screen reads `deviceInfo.getAppVersion()`, which only the
// in-memory driver provides (same as settings-notifications.spec.tsx).
vi.unmock('@perawallet/wallet-extension-platform-driver')
vi.unmock('@perawallet/wallet-extension-platform')

import {
    useAccountsStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { EVM_CHAIN_NETWORKS } from '@perawallet/wallet-core-chain-contract'
import { useRemoteConfigStore } from '@perawallet/wallet-core-remote-config'
import { evmRpcHandlers } from '@perawallet/wallet-core-chain-ethereum/test-handlers'
import { resetTestKeystore } from '@test-utils/algorand-keystore-test'
import {
    resetTestDatabase,
    setupTestDatabase,
    teardownTestDatabase,
} from '@test-utils/database-setup'
import { server } from '@test-utils/msw-server'
import { render } from '@test-utils/render'
import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import { longPress } from '@test-utils/rnw'
import { AccountSelection } from '@modules/accounts'
import { AccountOptionsContent } from '@modules/accounts/components/AccountOptionsContent'
import { SettingsNotificationsScreen } from '@modules/settings/screens/SettingsNotificationsScreen/SettingsNotificationsScreen'

import { SheetHost } from './__fixtures__/accountOptions'
import { ALGO25_TEST_ADDRESS } from './__fixtures__/onboarding'

const ETHEREUM_RPC_URL = 'https://ethereum.rpc.test/'
const ETH_ADDRESS = '0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed'

// The integration setup registers whichever chains config enables.
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
            chains: { enabled: ['algorand', 'ethereum'], capabilities: {} },
        },
        chainEndpointsFor: (
            chainId: Parameters<typeof actual.chainEndpointsFor>[0],
        ) =>
            chainId === 'ethereum'
                ? Object.fromEntries(
                      networks.ethereum.networks.map(({ id }) => [
                          id,
                          'https://ethereum.rpc.test/',
                      ]),
                  )
                : actual.chainEndpointsFor(chainId),
    }
})

const ETH_WATCH: WalletAccount = {
    id: 'eth-watch',
    custody: { kind: 'watch' },
    chains: { ethereum: { address: ETH_ADDRESS } },
    name: 'Eth watch',
}

const ALGO_WATCH: WalletAccount = {
    id: 'algo-watch',
    custody: { kind: 'watch' },
    chains: { algorand: { address: ALGO25_TEST_ADDRESS } },
    name: 'Algo watch',
}

describe('Flow: an Ethereum-only account in its options sheet, Settings → Notifications and the account header', () => {
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
        vi.mocked(Clipboard.setStringAsync).mockClear()
        // v3 registration names no chain and takes only Algorand addresses.
        useRemoteConfigStore
            .getState()
            .setConfigOverride('enable_device_registration_v4', true)
        const [mainnet] = EVM_CHAIN_NETWORKS.ethereum.networks
        server.use(
            ...evmRpcHandlers({
                rpcUrl: ETHEREUM_RPC_URL,
                responses: {
                    eth_chainId: `0x${mainnet!.eip155ChainId.toString(16)}`,
                    eth_getTransactionCount: '0x0',
                },
            }),
        )
    })

    afterEach(() => {
        useAccountsStore.getState().setAccounts([])
        useRemoteConfigStore.getState().resetState()
    })

    const renderOptions = (account: WalletAccount) =>
        render(
            <SheetHost
                contents={
                    <AccountOptionsContent
                        account={account}
                        onShowAddress={() => {}}
                    />
                }
            />,
        )

    it('Given an Ethereum-only account, when its options sheet opens, then it offers rename, remove and the notifications row its device registration needs', async () => {
        useAccountsStore.getState().setAccounts([ETH_WATCH])

        renderOptions(ETH_WATCH)

        await screen.findByTestId('account_option_rename-account')
        expect(screen.getByTestId('account_option_remove-account')).toBeTruthy()
        expect(
            screen.getByTestId('account_option_toggle-notifications'),
        ).toBeTruthy()
    })

    it('Given an Ethereum-only account, when the user taps rename, then the input opens holding its current name', async () => {
        useAccountsStore.getState().setAccounts([ETH_WATCH])
        renderOptions(ETH_WATCH)

        fireEvent.click(
            await screen.findByTestId('account_option_rename-account'),
        )

        const input = await screen.findByTestId('rename_account_input')
        expect((input as HTMLInputElement).value).toBe('Eth watch')
    })

    it('Given an Algorand and an Ethereum account, when the user opens Settings → Notifications, then both are listed', async () => {
        useAccountsStore.getState().setAccounts([ALGO_WATCH, ETH_WATCH])

        renderWithNavigation(
            SettingsNotificationsScreen,
            'SettingsNotifications',
        )

        expect(await screen.findByText('Algo watch')).toBeTruthy()
        expect(screen.getByText('Eth watch')).toBeTruthy()
    })

    it('Given an Ethereum account selected, when the user long-presses the account header, then its 0x address is copied', async () => {
        useAccountsStore.getState().setAccounts([ETH_WATCH])
        useAccountsStore.getState().setSelectedAccountId(ETH_WATCH.id)

        renderWithNavigation(() => <AccountSelection />, 'AccountSelectionHost')
        await longPress(screen.getByTestId('account_selection_button'))

        await waitFor(() =>
            expect(Clipboard.setStringAsync).toHaveBeenCalledWith(ETH_ADDRESS),
        )
    })
})
